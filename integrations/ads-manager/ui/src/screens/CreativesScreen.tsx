import { type FormEvent, useEffect, useRef, useState } from 'react';

import { archiveCreative, type HostKind, saveCreativeUrl, uploadCreative } from '../api/actions';
import { type Creative, safeUrl } from '../api/model';
import { useConfirm } from '../app/confirm';
import { failure, IDLE, info, Status, type Notice } from '../app/status';
import { PageHead, PlusIcon } from '../app/ui';
import { type Workspace, useWorkspace } from '../app/workspace-context';
import { Button, DataTable, Field, FileInput, Input, Panel, Select, StatusBadge } from '../components';
import { HelpLink } from '../help';

const MIME_OPTIONS = [
  ['video/mp4', 'MP4 영상'],
  ['video/webm', 'WebM 영상'],
  ['image/jpeg', 'JPEG 이미지'],
  ['image/png', 'PNG 이미지'],
  ['image/webp', 'WebP 이미지'],
  ['image/gif', 'GIF 이미지'],
] as const;

const ACCEPT = MIME_OPTIONS.map(([mime]) => mime).join(',');

type CreativesState = Workspace['creativesState'];

interface CreativeForm {
  creativeId: string;
  name: string;
  source: 'url' | 'upload';
  url: string;
  mime: string;
  alt: string;
}

interface MediaPreview {
  url: string;
  mime: string;
  alt: string;
}

const MEDIA_ERROR = '소재를 표시하지 못했어요. URL, 접근 권한, 파일 형식을 확인해 주세요.';

const CREATIVE_LIST_EMPTY = {
  idle: { title: '소재 목록을 불러오고 있어요.' },
  loading: { title: '소재 목록을 불러오고 있어요.' },
  error: { title: '소재 목록을 불러오지 못했어요.', description: '위의 다시 불러오기나 새로고침을 눌러 주세요.' },
  ready: { title: '아직 등록한 소재가 없어요.', description: 'URL 또는 파일로 첫 소재를 등록해 주세요.' },
} satisfies Record<CreativesState, { title: string; description?: string }>;

const EMPTY_FORM: CreativeForm = { creativeId: '', name: '', source: 'url', url: '', mime: 'video/mp4', alt: '' };

export function CreativesScreen({ titleId, title, host }: { titleId: string; title: string; host: HostKind }) {
  const { api, session, creatives, creativesState, reloadCreatives, run, setDirty } = useWorkspace();
  const confirm = useConfirm();
  const uploads = session.capabilities.uploads;
  const [form, setForm] = useState<CreativeForm>(EMPTY_FORM);
  const [editing, setEditing] = useState<Creative | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dirty, setFormDirty] = useState(false);
  const [listStatus, setListStatus] = useState<Notice>(IDLE);
  const [formStatus, setFormStatus] = useState<Notice>(IDLE);
  const [media, setMedia] = useState<MediaPreview | null>(null);
  // Remounts the file input to clear its selection; file inputs cannot be controlled.
  const [fileKey, setFileKey] = useState(0);
  const objectUrl = useRef<string | null>(null);
  const nameId = `${titleId}-name`;
  const reloadId = `${titleId}-reload`;

  useEffect(() => setDirty('creative', dirty), [dirty, setDirty]);
  useEffect(() => () => revokeObjectUrl(objectUrl), []);

  const clearMedia = () => {
    revokeObjectUrl(objectUrl);
    setMedia(null);
  };

  const update = (patch: Partial<CreativeForm>) => {
    setForm((current) => ({ ...current, ...patch }));
    setFormDirty(true);
    clearMedia();
  };

  /** Replaces the form with `creative` (or a blank form) without asking. */
  const load = (creative: Creative | null) => {
    setForm(
      creative
        ? {
            creativeId: creative.creativeId,
            name: creative.name,
            source: creative.source === 'upload' && uploads ? 'upload' : 'url',
            url: creative.url,
            mime: creative.mime,
            alt: creative.alt,
          }
        : EMPTY_FORM
    );
    setEditing(creative);
    setFile(null);
    setFileKey((key) => key + 1);
    setFormDirty(false);
    setFormStatus(IDLE);
    clearMedia();
    document.getElementById(nameId)?.focus();
  };

  const edit = async (creative: Creative | null) => {
    if (
      dirty &&
      !(await confirm({
        title: '입력을 버릴까요?',
        body: '현재 소재에 저장하지 않은 입력이 있어요. 버리면 되돌릴 수 없어요.',
        confirmLabel: '버리기',
        danger: true,
      }))
    ) {
      return;
    }

    load(creative);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(setFormStatus, async () => {
      let saved: Creative;

      if (form.source === 'upload') {
        if (!file) throw new Error('업로드할 파일을 선택해 주세요.');

        if (file.size > session.limits.uploadBytes)
          throw new Error('파일이 업로드 한도를 넘어요. 더 작은 파일을 선택해 주세요.');

        const data = new FormData();

        data.append('file', file);
        data.append('name', form.name.trim());
        data.append('alt', form.alt.trim());

        if (form.creativeId) data.append('creativeId', form.creativeId);

        saved = await uploadCreative(api, data);
      } else {
        const url = form.url.trim();
        if (!safeUrl(url)) throw new Error('올바른 HTTP(S) URL 또는 /로 시작하는 소재 경로를 입력해 주세요.');

        saved = await saveCreativeUrl(api, {
          name: form.name.trim(),
          url,
          mime: form.mime,
          alt: form.alt.trim(),
          creativeId: form.creativeId || undefined,
        });
      }

      load(saved);
      setFormStatus(info(`소재를 저장했어요(v${saved.version}). 편성에서 사용할 버전을 선택해 주세요.`));

      try {
        await reloadCreatives();
      } catch (error) {
        setListStatus(failure(`소재 목록을 다시 읽지 못했어요. ${error instanceof Error ? error.message : ''}`.trim()));
      }
    });
  };

  const previewInput = () => {
    clearMedia();

    if (form.source === 'upload') {
      if (!file) return setFormStatus(failure('미리 볼 파일을 선택해 주세요.'));

      objectUrl.current = URL.createObjectURL(file);
      setMedia({ url: objectUrl.current, mime: file.type, alt: form.alt });
    } else {
      if (!safeUrl(form.url.trim())) return setFormStatus(failure('올바른 소재 URL을 입력해 주세요.'));

      setMedia({ url: form.url.trim(), mime: form.mime, alt: form.alt });
    }

    setFormStatus(info('입력한 소재의 미리보기예요. 서버 저장·게시 여부와는 별개예요.'));
  };

  const previewSaved = (creative: Creative) => {
    clearMedia();

    if (!safeUrl(creative.url)) return setFormStatus(failure('저장된 소재 주소를 확인해 주세요.'));

    setMedia({ url: creative.url, mime: creative.mime, alt: creative.alt });
    setFormStatus(info(`저장된 “${creative.name}” v${creative.version} 미리보기예요. 편집 중인 입력은 그대로 있어요.`));
  };

  const archive = async (creative: Creative) => {
    const accepted = await confirm({
      title: `“${creative.name}” 소재를 보관할까요?`,
      body: '보관한 소재는 새 편성과 게시에 쓸 수 없어요. 이미 게시된 편성은 그대로 유지돼요.',
      confirmLabel: '보관',
      danger: true,
    });
    if (!accepted) return;

    void run(setListStatus, async () => {
      await archiveCreative(api, creative.creativeId);

      // The archive already happened; a failed reload must not report it as failed.
      try {
        await reloadCreatives();
        setListStatus(info('소재를 보관했어요. 기존 게시본은 그대로 유지돼요.'));
      } catch {
        setListStatus(failure('소재를 보관했어요. 목록은 다시 읽지 못했어요. 새로고침을 눌러 주세요.'));
      }

      document.getElementById(reloadId)?.focus();
    });
  };

  const reload = () =>
    void run(setListStatus, async () => {
      const items = await reloadCreatives();

      setListStatus(info(`${items.length}개 소재를 불러왔어요.`));
    });

  const upload = form.source === 'upload';
  const limitMiB = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 }).format(
    session.limits.uploadBytes / 1024 / 1024
  );

  return (
    <>
      <PageHead
        titleId={titleId}
        title={title}
        description={
          host === 'gnuboard' ? (
            <>
              사이트가 직접 내보내는 광고 소재예요. 파일을 바꾸면 새 버전이 생기고 기존 게시본은 그대로예요.{' '}
              <HelpLink termId="house-ad" />
            </>
          ) : (
            '파일을 바꾸면 새 버전이 생겨요. 기존 게시본과 기록은 그대로 유지돼요.'
          )
        }
        actions={
          <Button variant="primary" icon={<PlusIcon />} onClick={() => void edit(null)}>
            새 소재 등록
          </Button>
        }
      />
      <div className="aa-split">
        <div className="aa-stack">
          <Status status={listStatus} />
          <DataTable
            dense
            caption="등록한 소재 목록"
            hideCaption
            toolbar={
              <>
                <h2 className="sa-card-title">
                  {creativesState === 'ready' ? `등록한 소재 ${creatives.length}개` : '등록한 소재'}
                </h2>
                <span className="sa-small">
                  보관 <HelpLink termId="archive" />
                </span>
                <span className="sa-spacer" />
                <Button id={reloadId} size="sm" onClick={reload}>
                  새로고침
                </Button>
              </>
            }
            columns={[
              {
                key: 'name',
                header: '소재',
                render: (creative) => (
                  <div className="sa-name">
                    <b>{creative.name}</b>
                    <small>{creative.creativeId}</small>
                  </div>
                ),
              },
              { key: 'mime', header: '형식', render: (creative) => creative.mime },
              { key: 'version', header: '버전', numeric: true, render: (creative) => `v${creative.version}` },
              {
                key: 'status',
                header: '상태',
                render: (creative) =>
                  creative.archived ? (
                    <StatusBadge status="archived" />
                  ) : (
                    <StatusBadge status="active" label="사용 가능" />
                  ),
              },
              {
                key: 'actions',
                header: '동작',
                hideHeader: true,
                render: (creative) => (
                  <div className="sa-row">
                    <Button size="sm" onClick={() => previewSaved(creative)}>
                      미리보기
                    </Button>
                    <Button size="sm" disabled={creative.archived} onClick={() => void edit(creative)}>
                      새 버전으로 수정
                    </Button>
                    <Button size="sm" disabled={creative.archived} onClick={() => void archive(creative)}>
                      보관
                    </Button>
                  </div>
                ),
              },
            ]}
            rows={creatives}
            rowKey={(creative) => creative.creativeId}
            isSelected={(creative) => editing?.creativeId === creative.creativeId}
            empty={CREATIVE_LIST_EMPTY[creativesState]}
          />
        </div>

        <Panel
          title={editing ? '소재 새 버전 등록' : '새 소재 등록'}
          description={
            <>
              {editing
                ? `${editing.creativeId} · 현재 v${editing.version}. 저장하면 새 버전이 생기고 게시된 편성은 그대로예요.`
                : '영상과 이미지 · GIF를 등록할 수 있어요.'}{' '}
              <HelpLink termId="creative" />
            </>
          }
          onSubmit={submit}
          footer={
            <>
              <Button onClick={previewInput}>입력 소재 미리보기</Button>
              <Button type="submit" variant="primary">
                소재 저장
              </Button>
            </>
          }
        >
          <Field label="소재 이름" id={nameId}>
            <Input
              required
              maxLength={200}
              value={form.name}
              onChange={(event) => update({ name: event.currentTarget.value })}
            />
          </Field>
          <Field
            label="등록 방식"
            labelAside={<HelpLink termId="creative-source" />}
            help={uploads ? undefined : '이 설치에서는 파일 업로드를 쓸 수 없어요.'}
          >
            <Select
              value={form.source}
              onChange={(event) => update({ source: event.currentTarget.value === 'upload' ? 'upload' : 'url' })}
            >
              <option value="url">외부 URL</option>
              <option value="upload" disabled={!uploads}>
                파일 업로드
              </option>
            </Select>
          </Field>
          {upload ? (
            <Field label="소재 파일" help={`업로드 한도 ${limitMiB} MiB. 실제 파일 형식은 서버가 확인해요.`}>
              <FileInput
                key={fileKey}
                accept={ACCEPT}
                required
                onChange={(event) => {
                  setFile(event.currentTarget.files?.[0] ?? null);
                  setFormDirty(true);
                  clearMedia();
                }}
              />
            </Field>
          ) : (
            <>
              <Field label="소재 URL">
                <Input
                  required
                  inputMode="url"
                  placeholder="https://… 또는 /media/…"
                  value={form.url}
                  onChange={(event) => update({ url: event.currentTarget.value })}
                />
              </Field>
              <Field label="파일 형식">
                <Select value={form.mime} onChange={(event) => update({ mime: event.currentTarget.value })}>
                  {MIME_OPTIONS.map(([mime, label]) => (
                    <option key={mime} value={mime}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
            </>
          )}
          <Field
            label="대체텍스트"
            labelAside={<HelpLink termId="alt-text" />}
            help="이미지 광고의 내용을 짧게 설명해 주세요."
          >
            <Input maxLength={1000} value={form.alt} onChange={(event) => update({ alt: event.currentTarget.value })} />
          </Field>
          <Status status={formStatus} />
          {media ? (
            <div className="aa-media">
              {media.mime.startsWith('video/') ? (
                <video
                  src={media.url}
                  controls
                  playsInline
                  preload="metadata"
                  onError={() => setFormStatus(failure(MEDIA_ERROR))}
                />
              ) : (
                <img src={media.url} alt={media.alt} onError={() => setFormStatus(failure(MEDIA_ERROR))} />
              )}
            </div>
          ) : null}
        </Panel>
      </div>
    </>
  );
}

function revokeObjectUrl(ref: { current: string | null }) {
  if (ref.current) URL.revokeObjectURL(ref.current);

  ref.current = null;
}
