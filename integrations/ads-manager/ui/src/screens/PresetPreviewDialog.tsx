import { useId } from 'react';
import { createPortal } from 'react-dom';

import type { PresetEntry } from '../api/presets';
import { ButtonLink, Dialog } from '../components';
import { demoAddress, ThemePreview } from '../player';

const demoIcon = (
  <svg className="sa-ico" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M9 3h4v4M13 3 7.5 8.5M11 9.5V13H3V5h3.5" />
  </svg>
);

export interface PresetPreviewDialogProps {
  /** The preset to show with its saved values; `null` keeps the dialog closed. */
  target: PresetEntry | null;
  /** The preset has unsaved input in its editor, which this preview does not show. */
  unsaved: boolean;
  /** Public examples directory, e.g. `/examples/`. */
  examplesUrl: string;
  onClose: () => void;
}

/**
 * The preset list's "미리보기" (design Dialog A2-E): the saved preset in a wide modal. Closing unmounts the frame, so no
 * sound is left, and opening again builds the player afresh. It renders into `document.body` like `ApplyConfirm`.
 */
export function PresetPreviewDialog({ target, unsaved, examplesUrl, onClose }: PresetPreviewDialogProps) {
  const noteId = useId();

  if (!target) return null;

  const { preset } = target;
  const demoHref = preset.id ? demoAddress(examplesUrl, preset.id) : '';

  return createPortal(
    <Dialog
      open
      wide
      onClose={onClose}
      title={`${preset.name} 미리보기`}
      aside="저장된 값 · 통계에 남기지 않아요"
      describedBy={unsaved ? noteId : undefined}
      footer={
        <>
          {demoHref ? (
            <ButtonLink className="is-start" href={demoHref} target="_blank" rel="noopener noreferrer" icon={demoIcon}>
              데모에서 열기<span className="sa-sr"> (새 창)</span>
            </ButtonLink>
          ) : null}
          <button type="submit" className="sa-btn" value="close">
            닫기
          </button>
        </>
      }
    >
      {unsaved ? (
        <p className="sa-note" role="note" id={noteId}>
          <span>
            <b>저장된 값으로 보여요.</b> 이 프리셋에는 저장하지 않은 입력이 있어요. 편집 화면에서 저장하면 여기에도
            보여요.
          </span>
        </p>
      ) : null}
      {/* Saved values only, so no `demo`: its link sits in the footer here. */}
      <ThemePreview preset={preset} examplesUrl={examplesUrl} fitHeight />
    </Dialog>,
    document.body
  );
}
