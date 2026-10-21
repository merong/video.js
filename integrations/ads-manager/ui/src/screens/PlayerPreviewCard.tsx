import { type ReactNode, useId, useState } from 'react';

import { useLayoutWidth } from '../app/media-query';
import { Button, cx } from '../components';

export interface PlayerPreviewCardProps {
  /** The preset shown, such as `edit:p-…`; a different one starts folded again below the wide layout. */
  presetKey: string;
  /** `section` where the card is the page's main content; `aside` beside a form. */
  as?: 'aside' | 'section' | undefined;
  /** The one line beside the title (design PlayerPreview), such as "저장하기 전 입력도 보여요". */
  aside: string;
  /** Adds the note that native video shows browser controls. */
  native: boolean;
  /** Placement class from the screen, such as `aa-editor-preview`. */
  className?: string | undefined;
  /** `ThemePreview` and its notes. */
  children: ReactNode;
}

/**
 * The "플레이어 미리보기" card of the preset editor and the built-in preset page. Below the wide layout it starts folded behind
 * a "열기" button, so the form or notice comes first on a phone.
 */
export function PlayerPreviewCard({
  presetKey,
  as: Card = 'aside',
  aside,
  native,
  className,
  children,
}: PlayerPreviewCardProps) {
  const width = useLayoutWidth();
  const [open, setOpen] = useState(width === 'wide');
  const [openFor, setOpenFor] = useState(presetKey);
  const id = useId();

  // The screens keep this card mounted when only the address changes to another preset; that one starts afresh.
  // Resetting here, not by `key`, keeps the preview frame.
  if (openFor !== presetKey) {
    setOpenFor(presetKey);
    setOpen(width === 'wide');
  }

  return (
    <Card className={cx('sa-card sa-ppv', className)} aria-labelledby={`${id}-title`}>
      <div className="sa-ppv-h">
        <h2 className="sa-card-title" id={`${id}-title`}>
          플레이어 미리보기
        </h2>
        <div className="sa-row">
          <span className="sa-small">{aside}</span>
          {width === 'wide' ? null : (
            <Button size="sm" aria-expanded={open} aria-controls={id} onClick={() => setOpen((value) => !value)}>
              {open ? '접기' : '열기'}
            </Button>
          )}
        </div>
      </div>
      <div className="sa-ppv" id={id} hidden={width !== 'wide' && !open}>
        {native ? (
          <p className="sa-small">기본 video는 브라우저 컨트롤로 보여요. 로고와 이전·이후 버튼은 나오지 않아요.</p>
        ) : null}
        {children}
      </div>
    </Card>
  );
}
