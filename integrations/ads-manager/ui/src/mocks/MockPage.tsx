import { type ReactNode, type Ref, useEffect, useRef, useState } from 'react';

import { MockBadge } from '../components';

/** Reason shown beside every disabled write button on mock screens. */
export const MOCK_WRITE_REASON = '목업 화면이라 아직 동작하지 않아요.';

/**
 * List and detail inside one mock screen, without touching the URL. After a switch, focus moves to the new title.
 * Buttons that only switch views carry `data-mock-nav`; every other button on a mock screen is a disabled write.
 */
export function useMockView() {
  const [openId, setOpenId] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const switched = useRef(false);

  useEffect(() => {
    if (!switched.current) return;

    headingRef.current?.focus();
  }, [openId]);

  const show = (id: string | null) => {
    switched.current = true;
    setOpenId(id);
  };

  return { openId, show, headingRef };
}

export interface MockPageProps {
  title: string;
  description?: ReactNode;
  /** Right side of the page head: disabled write buttons. */
  actions?: ReactNode;
  /** Above the title, e.g. a back button. */
  before?: ReactNode;
  /** Beside the title, e.g. a status badge. */
  titleExtra?: ReactNode;
  /** Receives focus when the view changes inside the screen. */
  headingRef?: Ref<HTMLHeadingElement> | undefined;
  children: ReactNode;
}

/** Page head with the mock badge beside the title, then the screen body. */
export function MockPage({ title, description, actions, before, titleExtra, headingRef, children }: MockPageProps) {
  return (
    <div className="sa-main">
      <div className="sa-phead">
        <div>
          {before}
          <div className="sa-row">
            <h1 className="sa-page-title" ref={headingRef} tabIndex={headingRef ? -1 : undefined}>
              {title}
            </h1>
            {titleExtra}
            <MockBadge />
          </div>
          {description !== undefined && <p className="sa-small">{description}</p>}
        </div>
        {actions !== undefined && <div className="sa-row">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
