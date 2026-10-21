import { type FormEvent, useEffect, useRef, useState } from 'react';

import { previewSchedule } from '../api/actions';
import { editorPayload, type EditorRecord, safeUrl, videoIdProblem } from '../api/model';
import { playerPresets, type PresetList } from '../api/presets';
import { DEFAULT_CONTENT_PATH } from '../app/config';
import { failure, IDLE, info, Status, type Notice } from '../app/status';
import { useWorkspace } from '../app/workspace-context';
import { Button, Field, Input, Panel, Select } from '../components';
import { HelpLink } from '../help';
import { DEFAULT_PLAYER_PRESET, PlayerTestLinks, ThemePreview } from '../player';
import type { PreviewSource } from '../player/theme-preview';
import { resolveHttpUrl } from '../player/url';

const VIDEO_ID_INPUT = 'aa-playback-video-id';

interface PreparedPreview {
  key: number;
  /** The editor revision the preview was prepared from; any later edit or reload makes it stale. */
  revision: number;
  /** The menu activation it was prepared in; leaving the menu stops it for good. */
  activation: number;
  /** One object per preparation, so the frame gets it again only when it changes. */
  source: PreviewSource;
}

/**
 * F4 plays the editor's current (unsaved) schedule in the player preview frame (`examples/preview.html`), which never
 * sends collector requests, with the picked preset. F5 links to the playback test page, which plays the published
 * schedule through the real collection path. One preset pick serves both.
 *
 * Visited menus stay mounted (hidden), so the frame is unmounted, which stops it, whenever this menu is not active. A
 * preview is one-off: coming back asks for a new one.
 */
export function PlaybackPanel({
  draft,
  videoNames,
  revisionKey,
  activation,
}: {
  draft: EditorRecord | null;
  /** Video names the schedule screen has seen, by fixed video ID; the preview sends the played one as its title. */
  videoNames: ReadonlyMap<string, string>;
  revisionKey: number;
  /** The menu's current activation; `null` while hidden. */
  activation: number | null;
}) {
  const { api, publicBase, run } = useWorkspace();
  const targetVideo = draft?.target.type === 'video' ? draft.target.id : null;
  const [contentUrl, setContentUrl] = useState(() => `${publicBase}${DEFAULT_CONTENT_PATH}`);
  const [videoId, setVideoId] = useState('');
  const [status, setStatus] = useState<Notice>(IDLE);
  const [prepared, setPrepared] = useState<PreparedPreview | null>(null);
  const request = useRef(0);
  const [presets, setPresets] = useState<PresetList | null>(null);
  const [presetsError, setPresetsError] = useState(false);
  /** `null` follows the default preset. */
  const [presetId, setPresetId] = useState<string | null>(null);
  const effectiveVideoId = targetVideo ?? videoId.trim();
  // An empty field is allowed: the preview then uses the edited target, and the test links ask for an ID.
  const videoIdError = targetVideo === null && videoId !== '' ? videoIdProblem(effectiveVideoId) : null;

  // Re-read on every visit so presets saved in the players menu show up; a read takes no admin token.
  useEffect(() => {
    if (activation === null) return;

    let current = true;

    playerPresets(api).then(
      (next) => {
        if (!current) return;

        setPresets(next);
        setPresetsError(false);
      },
      () => {
        if (current) setPresetsError(true);
      }
    );

    return () => {
      current = false;
    };
  }, [api, activation]);

  const selectedPreset = presets?.presets.some((entry) => entry.preset.id === presetId)
    ? presetId
    : (presets?.defaultPresetId ?? null);
  const selectedEntry = presets?.presets.find((entry) => entry.preset.id === selectedPreset);
  // Without a list the preview plays package defaults, as the test links do.
  const previewPreset = selectedEntry?.preset ?? DEFAULT_PLAYER_PRESET;

  const stop = (next: Notice = IDLE) => {
    request.current += 1;
    setPrepared(null);
    setStatus(next);
  };

  const edited = prepared !== null && prepared.revision !== revisionKey;
  const left = prepared !== null && prepared.activation !== activation;
  const live = edited || left ? null : prepared;
  const shownStatus = edited
    ? info('편성이 바뀌었어요. 미리보기를 다시 준비해 주세요.')
    : left
      ? info('다른 메뉴로 이동해서 미리보기를 멈췄어요. 다시 준비해 주세요.')
      : status;

  const inputChanged = () => stop(live ? info('입력이 바뀌었어요. 미리보기를 다시 준비해 주세요.') : IDLE);

  const submit = (event: FormEvent) => {
    event.preventDefault();

    if (!draft || activation === null) return;

    if (videoIdError) {
      stop(failure('미리보기를 준비하지 못했어요. 고정 영상 ID를 확인해 주세요.'));
      document.getElementById(VIDEO_ID_INPUT)?.focus();
      return;
    }

    request.current += 1;
    const current = request.current;
    const revision = revisionKey;
    const preparedIn = activation;
    const url = contentUrl.trim();

    setPrepared(null);
    void run(setStatus, async () => {
      // Absolute, as the loader's `data-src` takes it; other origins are allowed (contract §6).
      const content = safeUrl(url) ? resolveHttpUrl(url, document.baseURI) : null;
      if (!content) throw new Error('본편 주소는 HTTP(S) 주소나 /로 시작하는 경로로 입력해 주세요.');

      const payload = editorPayload(draft);
      const target = payload.target;
      const schedule = await previewSchedule(api, {
        ...payload,
        videoId: effectiveVideoId,
        boardId: target.type === 'board' ? target.id : (target.boardId ?? null),
        categoryId: target.type === 'category' ? target.id : null,
      });

      if (current !== request.current) return;

      // Without a known name the frame titles the content with the schedule's video ID.
      const title = videoNames.get(effectiveVideoId);

      setPrepared({
        key: current,
        revision,
        activation: preparedIn,
        source: { schedule, content: content.href, title },
      });
      // The preview announces its own status; repeating it here would read it twice.
      setStatus(IDLE);
    });
  };

  const previewBlocked = draft ? undefined : '편성을 불러오면 미리볼 수 있어요.';

  return (
    <Panel
      title="재생 확인"
      description="본편 영상과 고정 영상 ID로 게시 전 편성과 게시본을 각각 재생해 봐요."
      onSubmit={submit}
    >
      <div className="aa-form-grid">
        <Field label="본편 영상 URL" help="기본값은 데모 본편이에요. 실제 서비스 영상 주소로 바꿀 수 있어요.">
          <Input
            required
            inputMode="url"
            placeholder="https://…/content.mp4 또는 /media/content.mp4"
            value={contentUrl}
            onChange={(event) => {
              setContentUrl(event.currentTarget.value);
              inputChanged();
            }}
          />
        </Field>
        <Field
          id={VIDEO_ID_INPUT}
          label="고정 영상 ID"
          labelAside={<HelpLink termId="fixed-video-id" />}
          help={
            targetVideo
              ? '편집 중인 영상 대상의 ID를 써요.'
              : '재생할 영상의 고정 ID예요. 더 구체적인 게시 설정이 우선할 수 있어요.'
          }
          error={videoIdError}
        >
          <Input
            required
            maxLength={128}
            readOnly={targetVideo !== null}
            value={targetVideo ?? videoId}
            onChange={(event) => {
              setVideoId(event.currentTarget.value);
              inputChanged();
            }}
          />
        </Field>
      </div>

      <section className="sa-ppv sa-card" aria-labelledby="aa-preview-title">
        <div className="sa-ppv-h">
          <div className="sa-row">
            <h3 id="aa-preview-title" className="sa-card-title">
              게시 전 미리보기
            </h3>
            <HelpLink termId="preview" />
          </div>
          <span className="sa-small">통계에 남기지 않아요</span>
        </div>
        <Field
          label="적용할 프리셋"
          labelAside={<HelpLink termId="player-preset" />}
          help={
            presetsError
              ? presets
                ? '최신 프리셋 목록을 불러오지 못했어요. 이전 목록으로 보여 줘요. 메뉴를 다시 열면 다시 불러와요.'
                : '프리셋 목록을 불러오지 못해 패키지 기본값으로 재생해요. 메뉴를 다시 열면 다시 불러와요.'
              : '고른 프리셋 모양으로 이 초안을 재생해요. 편성에는 저장되지 않아요.'
          }
        >
          <Select
            disabled={!presets}
            value={selectedPreset ?? ''}
            onChange={(event) => setPresetId(event.currentTarget.value)}
          >
            {presets ? (
              presets.presets.map(({ preset }) => (
                <option key={preset.id} value={preset.id ?? ''}>
                  {preset.name}
                  {preset.id === presets.defaultPresetId ? ' (사이트 적용)' : ''}
                </option>
              ))
            ) : (
              <option value="">{presetsError ? '패키지 기본값' : '불러오는 중'}</option>
            )}
          </Select>
        </Field>
        <div className="sa-row">
          <Button type="submit" variant="primary" disabledReason={previewBlocked}>
            미리보기 준비
          </Button>
          {/* Closing removes the frame, which stops playback. */}
          <Button disabled={!live} onClick={() => stop(info('미리보기를 닫았어요.'))}>
            미리보기 닫기
          </Button>
        </div>
        <Status status={shownStatus} />
        {live ? (
          <ThemePreview
            key={live.key}
            preset={previewPreset}
            examplesUrl={`${publicBase}examples/`}
            source={live.source}
          />
        ) : null}
        <p className="sa-help">
          HLS 엔진 고르기는 아래 재생 테스트에서 확인해 주세요. 도움말이나 다른 메뉴를 열면 미리보기가 멈춰요.
        </p>
      </section>

      <div className="sa-panel" role="group" aria-labelledby="aa-published-title">
        <div className="sa-row">
          <h3 id="aa-published-title" className="sa-card-title">
            게시본 재생 테스트
          </h3>
          <HelpLink termId="play-test" />
        </div>
        <p className="sa-small">저장·게시하지 않은 변경은 반영되지 않아요. 위 ‘적용할 프리셋’으로 재생해요.</p>
        {videoIdError ? (
          <p className="sa-help">고정 영상 ID를 고치면 재생 테스트 링크를 만들어요.</p>
        ) : (
          <PlayerTestLinks
            examplesUrl={`${publicBase}examples/`}
            videoId={effectiveVideoId}
            contentUrl={contentUrl.trim()}
            presetId={selectedPreset}
            {...(selectedEntry ? { presetPlayerType: selectedEntry.preset.playerType } : {})}
          />
        )}
      </div>
    </Panel>
  );
}
