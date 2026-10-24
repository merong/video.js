import { type DragEvent, useEffect, useId, useRef, useState } from 'react';

import { ApiError } from '../api/client';
import { deleteLogo, type LogoItem, type LogoLimits, SAMPLE_LOGO_ID, uploadLogo } from '../api/logos';
import { useConfirm } from '../app/confirm';
import { describeError, failure, IDLE, info, Status, type Notice } from '../app/status';
import { useWorkspace } from '../app/workspace-context';
import { Button, Field, Input, Note, Segmented, StatusBadge } from '../components';
import { findLogo, type LogoLibraryState } from './logo-library';

export type LogoSource = 'none' | 'library' | 'url';

/** What an image address check found; `null` sizes come from an SVG without its own size. */
export type ImageCheck =
  | { state: 'checking' }
  | { state: 'ok'; width: number; height: number }
  | { state: 'error'; reason: 'load' | 'timeout' | 'empty' };

export const IMAGE_CHECK_TIMEOUT_MS = 8000;
const CHECK_DELAY_MS = 600;
const READ_ONLY_REASON = '읽기 권한만 있어 로고를 올리거나 지울 수 없어요.';
const IN_USE_REASON = '플레이어 설정에서 쓰고 있어 지울 수 없어요. 다른 로고로 바꿔 저장한 뒤 지워 주세요.';
const CHECK_ERRORS = {
  load: '이미지를 불러오지 못했어요. 주소가 맞는지, 이미지 파일인지 확인해 주세요.',
  timeout: '이미지가 8초 안에 열리지 않았어요. 주소를 확인하거나 잠시 뒤 다시 확인해 주세요.',
  empty: '이미지 크기가 0이에요. 다른 이미지 주소를 넣어 주세요.',
} satisfies Record<Extract<ImageCheck, { state: 'error' }>['reason'], string>;
const STAGE_EMPTY = {
  none: '로고를 쓰지 않아요. 플레이어에 로고가 보이지 않아요.',
  library: '보관함에서 로고를 골라 주세요.',
  url: '이미지 주소를 확인하면 여기에 보여요.',
} satisfies Record<LogoSource, string>;
const MIME_NAMES = new Map([
  ['image/png', 'PNG'],
  ['image/svg+xml', 'SVG'],
  ['image/gif', 'GIF'],
  ['image/webp', 'WebP'],
  ['image/jpeg', 'JPEG'],
]);

/** Loads `url` as an image in this browser; the server never fetches logo addresses (contract R1 3). */
export function checkImage(url: string, timeoutMs = IMAGE_CHECK_TIMEOUT_MS): Promise<ImageCheck> {
  return new Promise((resolve) => {
    const image = new Image();
    const timer = setTimeout(() => finish({ state: 'error', reason: 'timeout' }), timeoutMs);
    const finish = (result: ImageCheck) => {
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      resolve(result);
    };

    image.onload = () =>
      finish(
        image.naturalWidth > 0 && image.naturalHeight > 0
          ? { state: 'ok', width: image.naturalWidth, height: image.naturalHeight }
          : { state: 'error', reason: 'empty' }
      );
    image.onerror = () => finish({ state: 'error', reason: 'load' });
    image.src = url;
  });
}

/** "1MB", "512KB". */
export function byteSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round((bytes / (1024 * 1024)) * 10) / 10}MB`;

  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

/** Why `file` cannot go up, or `null`; the server checks the content again. */
export function uploadProblem(file: File, limits: LogoLimits): string | null {
  const names = limits.mimes.map((mime) => MIME_NAMES.get(mime) ?? mime).join(', ');

  if (file.type && !limits.mimes.includes(file.type)) return `${names} 파일만 올릴 수 있어요.`;

  if (file.size > limits.bytes) {
    return `파일이 ${byteSize(limits.bytes)}보다 커요(${byteSize(file.size)}). 용량을 줄여서 다시 올려 주세요.`;
  }

  return null;
}

export interface LogoPickerProps {
  assetId: string;
  url: string;
  /** Ids from `presetFieldId` for `logo.assetId` and `logo.url`, so a save error can focus them. */
  ids: { assetId: string; url: string };
  errors: { assetId?: string | undefined; url?: string | undefined };
  change: (path: 'logo.assetId' | 'logo.url', value: string) => void;
  logos: LogoLibraryState;
  /** An address that failed or is still being checked; the editor refuses to save it. */
  onInvalidChange: (invalid: boolean) => void;
}

/** Logo image for the preset editor: none, a library logo, or an image address checked in the browser. */
export function LogoPicker({ assetId, url, ids, errors, change, logos, onInvalidChange }: LogoPickerProps) {
  const { api, session, publicBase, run } = useWorkspace();
  const confirm = useConfirm();
  const { library, replace } = logos;
  const canWrite = session.canWrite;
  const uploads = session.capabilities.logos === true;
  const [picked, setPicked] = useState<LogoSource | null>(null);
  const [check, setCheck] = useState<{ url: string; result: ImageCheck } | null>(null);
  const [uploadStatus, setUploadStatus] = useState<Notice>(IDLE);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadHelpId = useId();
  const limits = library?.limits ?? null;
  // A saved value decides the choice; the picked one only matters while both values are empty.
  const source: LogoSource = url ? 'url' : assetId ? 'library' : (picked ?? 'none');
  const address = url.trim();
  const result = check?.url === address ? check.result : address ? ({ state: 'checking' } as const) : null;
  const invalid = source === 'url' && address !== '' && result?.state !== 'ok';
  const sampleItem: LogoItem = findLogo(library, SAMPLE_LOGO_ID) ?? {
    logoId: SAMPLE_LOGO_ID,
    name: '샘플 로고',
    url: `${publicBase}player/logo-sample.svg`,
    mime: 'image/svg+xml',
    bytes: null,
    width: null,
    height: null,
    builtIn: true,
    inUse: false,
    createdAt: null,
  };
  const items = library?.items.length ? library.items : [sampleItem];
  const selected = source === 'library' ? (items.find((item) => item.logoId === assetId) ?? null) : null;
  const shownSrc =
    source === 'library' ? (selected?.url ?? null) : source === 'url' && result?.state === 'ok' ? address : null;

  useEffect(() => onInvalidChange(invalid), [invalid, onInvalidChange]);

  const verify = async (value: string) => {
    if (!value) return;

    setCheck({ url: value, result: { state: 'checking' } });

    const found = await checkImage(value);

    setCheck((current) => (current?.url === value ? { url: value, result: found } : current));
  };

  const checkedUrl = check?.url;

  // A typed address is checked after a short pause; "확인" checks at once.
  useEffect(() => {
    if (source !== 'url' || !address || checkedUrl === address) return;

    const timer = setTimeout(() => void verify(address), CHECK_DELAY_MS);

    return () => clearTimeout(timer);
    // `verify` only sets state; the pause restarts on a new address, not on each render.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [source, address, checkedUrl]);

  const choose = (next: LogoSource) => {
    setPicked(next);

    if (next !== 'url' && url) change('logo.url', '');

    if (next !== 'library' && assetId) change('logo.assetId', '');

    if (next === 'library' && !assetId) change('logo.assetId', SAMPLE_LOGO_ID);
  };

  const upload = (file: File) => {
    const problem = limits ? uploadProblem(file, limits) : null;
    if (problem) return setUploadStatus(failure(problem));

    setBusy(true);
    setUploadStatus(info(`${file.name}을(를) 올리는 중이에요.`));
    void run(setUploadStatus, async () => {
      try {
        const next = await uploadLogo(api, file);

        replace(next);

        if (next.logo) change('logo.assetId', next.logo.logoId);

        setUploadStatus(info(`${next.logo?.name ?? file.name} 로고를 올리고 골랐어요. 저장하면 플레이어에 반영돼요.`));
      } catch (error) {
        throw error instanceof ApiError ? uploadError(error, limits) : error;
      }
    }).finally(() => setBusy(false));
  };

  const remove = async (item: LogoItem) => {
    if (
      !(await confirm({
        title: `${item.name} 로고를 지울까요?`,
        body: '보관함과 서버에서 파일을 지워요. 지운 로고는 되돌릴 수 없어요.',
        confirmLabel: '지우기',
        danger: true,
      }))
    ) {
      return;
    }

    await run(setUploadStatus, async () => {
      try {
        replace(await deleteLogo(api, item.logoId));
      } catch (error) {
        if (error instanceof ApiError && error.code === 'logo_in_use')
          throw new ApiError(IN_USE_REASON, 409, error.code);

        throw error;
      }

      if (assetId === item.logoId) change('logo.assetId', '');

      setUploadStatus(info(`${item.name} 로고를 지웠어요.`));
    });
  };

  const drop = (event: DragEvent) => {
    event.preventDefault();
    setDrag(false);

    const file = event.dataTransfer.files[0];

    if (file && canWrite && uploads && !busy) upload(file);
  };

  const limitText = limits
    ? `${limits.mimes.map((mime) => MIME_NAMES.get(mime) ?? mime).join(', ')} · ${byteSize(limits.bytes)} 이하 · 최대 ${limits.count}개`
    : null;

  return (
    <div className="aa-stack">
      <LogoStage src={shownSrc} empty={STAGE_EMPTY[source]} />
      <Segmented
        label="로고 이미지"
        id={source === 'url' ? undefined : ids.assetId}
        value={source}
        options={[
          { value: 'none', label: '사용 안 함' },
          { value: 'library', label: '보관함에서 고르기' },
          { value: 'url', label: '이미지 주소' },
        ]}
        onChange={choose}
        help="투명 배경 PNG, SVG, GIF, WebP를 쓸 수 있어요. 폭 200px 안팎의 투명 배경 이미지를 권해요."
        error={errors.assetId}
      />

      {source === 'library' ? (
        <div className="aa-stack">
          <fieldset className="aa-logo-grid" aria-describedby={uploadHelpId}>
            <legend className="sa-label">보관함 로고</legend>
            {items.map((item) => (
              <div key={item.logoId} className={item.logoId === assetId ? 'aa-logo-card is-selected' : 'aa-logo-card'}>
                <label className="aa-logo-pick">
                  <input
                    type="radio"
                    name={`${ids.assetId}-library`}
                    value={item.logoId}
                    checked={item.logoId === assetId}
                    aria-describedby={`${ids.assetId}-${item.logoId}-meta`}
                    onChange={() => change('logo.assetId', item.logoId)}
                  />
                  <span className="aa-logo-thumb">
                    <img src={item.url} alt="" loading="lazy" />
                  </span>
                  <span className="sa-name">{item.name}</span>
                </label>
                <span className="sa-small" id={`${ids.assetId}-${item.logoId}-meta`}>
                  {[
                    item.builtIn ? '기본 제공' : null,
                    item.width && item.height ? `${item.width}×${item.height}` : null,
                    item.bytes ? byteSize(item.bytes) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                <span className="sa-row">
                  {item.logoId === assetId ? <StatusBadge status="active" label="고름" /> : null}
                  {item.inUse ? <span className="sa-badge">쓰는 중</span> : null}
                  {item.builtIn ? null : (
                    <Button
                      size="sm"
                      variant="danger"
                      aria-label={`${item.name} 지우기`}
                      disabledReason={
                        !canWrite
                          ? '읽기 권한만 있어 지울 수 없어요.'
                          : item.inUse
                            ? '쓰는 중이라 지울 수 없어요.'
                            : undefined
                      }
                      onClick={() => void remove(item)}
                    >
                      지우기
                    </Button>
                  )}
                </span>
              </div>
            ))}
          </fieldset>
          {uploads ? (
            <div
              className={`sa-upload${drag ? ' is-drag' : ''}${busy ? ' is-busy' : ''}`}
              role="group"
              aria-label="로고 올리기"
              aria-describedby={uploadHelpId}
              aria-busy={busy || undefined}
              onDragOver={(event) => {
                event.preventDefault();

                if (canWrite && !busy) setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={drop}
            >
              <span className="sa-small">이미지 파일을 여기에 끌어다 놓거나 버튼으로 골라요.</span>
              <input
                ref={fileInput}
                type="file"
                hidden
                accept={(limits?.mimes ?? [...MIME_NAMES.keys()]).join(',')}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];

                  event.currentTarget.value = '';

                  if (file) upload(file);
                }}
              />
              <Button
                disabledReason={!canWrite ? READ_ONLY_REASON : busy ? '올리는 중이에요.' : undefined}
                onClick={() => fileInput.current?.click()}
              >
                로고 올리기
              </Button>
            </div>
          ) : null}
          <p className="sa-help" id={uploadHelpId}>
            {uploads
              ? `올릴 수 있는 파일: ${limitText ?? 'PNG, SVG, GIF, WebP, JPEG · 1MB 이하'}. 플레이어 설정에서 쓰고 있는 로고는 지울 수 없어요.`
              : '로고 올리기는 서버를 새 버전으로 올리면 쓸 수 있어요. 지금은 샘플 로고만 고를 수 있어요.'}
          </p>
          <Status status={uploadStatus} />
          {logos.status.text ? (
            <Note
              tone="warn"
              actions={
                <Button size="sm" onClick={logos.reload}>
                  다시 불러오기
                </Button>
              }
            >
              {logos.status.text}
            </Note>
          ) : null}
        </div>
      ) : null}

      {source === 'url' ? (
        <div className="aa-stack">
          <Field
            label="로고 이미지 주소"
            id={ids.url}
            error={errors.url ?? (result?.state === 'error' ? CHECK_ERRORS[result.reason] : undefined)}
            help="https:// 주소나 /로 시작하는 이 사이트 경로를 넣어요. http:// 이미지는 https 사이트에서 막혀요."
          >
            <Input
              value={url}
              type="url"
              inputMode="url"
              maxLength={2048}
              placeholder="https://example.com/logo.png"
              onChange={(event) => change('logo.url', event.currentTarget.value)}
            />
          </Field>
          <div className="sa-row">
            <Button size="sm" disabled={!address || result?.state === 'checking'} onClick={() => void verify(address)}>
              확인
            </Button>
            <Status
              status={
                result?.state === 'ok'
                  ? info(`이미지를 확인했어요. ${result.width}×${result.height}px이에요.`)
                  : result?.state === 'checking'
                    ? info('이미지를 확인하는 중이에요. 확인이 끝나야 저장할 수 있어요.')
                    : IDLE
              }
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** The chosen logo on a dark and a light background, so a logo for one of them still shows. */
function LogoStage({ src, empty }: { src: string | null; empty: string }) {
  if (!src) {
    return (
      <div className="aa-logo-stage is-empty">
        <p className="sa-small">{empty}</p>
      </div>
    );
  }

  return (
    <div className="aa-logo-stage" role="group" aria-label="로고 미리보기">
      <span className="aa-logo-bg is-dark">
        <img src={src} alt="어두운 바탕의 로고" />
      </span>
      <span className="aa-logo-bg is-light">
        <img src={src} alt="밝은 바탕의 로고" />
      </span>
    </div>
  );
}

function uploadError(error: ApiError, limits: LogoLimits | null): ApiError {
  const rewrite = (message: string) => new ApiError(message, error.status, error.code);

  switch (error.code) {
    case 'upload_size':
      return rewrite(
        `파일이 너무 커요. ${limits ? `${byteSize(limits.bytes)} 이하로` : '용량을 줄여서'} 다시 올려 주세요.`
      );
    case 'logo_limit':
      return rewrite(`보관함은 ${limits?.count ?? 50}개까지예요. 쓰지 않는 로고를 지운 뒤 다시 올려 주세요.`);
    case 'validation': {
      const message = describeError(error).message.text;

      return rewrite(message || '올릴 수 없는 이미지예요. 다른 파일을 골라 주세요.');
    }
    default:
      return error;
  }
}
