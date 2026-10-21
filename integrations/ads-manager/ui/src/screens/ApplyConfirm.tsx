import { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';

import type { PresetEntry } from '../api/presets';
import { type Notice, Status } from '../app/status';
import { Button, Dialog, KeyValue, Note } from '../components';
import type { PlayerPreset } from '../player';

export const PLAYER_TYPE_LABELS = { videojs: 'Video.js 플레이어', native: '기본 video' } as const;

export const LANGUAGE_LABELS = {
  ko: '한국어',
  en: '영어',
  ja: '일본어',
  'zh-CN': '중국어 간체',
} satisfies Record<NonNullable<PlayerPreset['language']>, string>;

export function languageLabel(language: PlayerPreset['language']): string {
  return language ? LANGUAGE_LABELS[language] : '페이지 언어';
}

function summary(preset: PlayerPreset): string {
  return `${preset.name} · ${PLAYER_TYPE_LABELS[preset.playerType]} · ${languageLabel(preset.language)}`;
}

export interface ApplyConfirmProps {
  /** The preset to apply; `null` keeps the dialog closed. */
  target: PresetEntry | null;
  /** The site-applied preset now. */
  current: PresetEntry | undefined;
  busy: boolean;
  status: Notice;
  apply: () => void;
  onClose: () => void;
}

/**
 * Confirms "사이트에 적용". It renders into `document.body`: the main area is inert while the write runs, and the dialog
 * shows its own progress and failure there.
 */
export function ApplyConfirm({ target, current, busy, status, apply, onClose }: ApplyConfirmProps) {
  const cancelId = useId();
  const targetId = target?.preset.id;

  // The safe choice gets the first focus, not the header's close button. The dialog opened in its own effect already.
  useEffect(() => {
    if (targetId) document.getElementById(cancelId)?.focus();
  }, [targetId, cancelId]);

  if (!target) return null;

  const { preset } = target;

  return createPortal(
    <Dialog
      open
      onClose={onClose}
      title={`"${preset.name}" 프리셋을 사이트에 적용할까요?`}
      closeLabel="취소하고 닫기"
      footer={
        <>
          <Status status={status} />
          <Button id={cancelId} disabled={busy} onClick={onClose}>
            취소
          </Button>
          <Button variant="primary" disabled={busy} onClick={apply}>
            사이트에 적용
          </Button>
        </>
      }
    >
      <div className="aa-stack">
        <p className="sa-body">
          로더를 넣은 사이트의 모든 플레이어가 이 프리셋으로 바뀌어요. 방문자가 페이지를 새로고침하면 바로 보여요.
        </p>
        <KeyValue
          label="사이트 적용 변경"
          rows={[
            { key: 'current', label: '지금 사이트 적용', value: current ? summary(current.preset) : '—' },
            { key: 'next', label: '바꿀 프리셋', value: summary(preset) },
          ]}
        />
        {preset.playerType === 'native' ? (
          <Note tone="warn" title={`${preset.name} · 기본 video 프리셋이에요`}>
            사이트의 플레이어에서 로고, 컨트롤 켜기·끄기, 단축키 설정이 빠지고 브라우저 컨트롤로 보여요.
          </Note>
        ) : null}
      </div>
    </Dialog>,
    document.body
  );
}
