import type { MouseEvent, ReactNode } from 'react';

import { isPlainClick } from '../components/TopNav';
import { HELP_TERMS, type HelpTermId, helpTerms } from './terms';

const REOPEN_EVENT = 'sa-help-reopen';

export function helpHref(termId: HelpTermId): string {
  return `#/help/${termId}`;
}

/** Listens for links to the term already in the address; the hash does not change, so `hashchange` never fires. */
export function onHelpReopen(listener: (termId: HelpTermId) => void): () => void {
  function handle(event: Event) {
    const termId = event instanceof CustomEvent ? helpTerms.find((id) => id === event.detail) : undefined;

    if (termId) listener(termId);
  }

  window.addEventListener(REOPEN_EVENT, handle);
  return () => window.removeEventListener(REOPEN_EVENT, handle);
}

export interface HelpLinkProps {
  termId: HelpTermId;
  /** Link text. Without it the link is a small "?" named "<용어> 도움말". */
  children?: ReactNode;
}

/** Link from a field or label to its term in the help dictionary. */
export function HelpLink({ termId, children }: HelpLinkProps) {
  const isIcon = children === undefined;
  const href = helpHref(termId);

  function reopen(event: MouseEvent<HTMLAnchorElement>) {
    if (!isPlainClick(event) || window.location.hash !== href) return;

    event.preventDefault();
    window.dispatchEvent(new CustomEvent(REOPEN_EVENT, { detail: termId }));
  }

  return (
    <a
      className={isIcon ? 'sa-help-link' : 'sa-link'}
      href={href}
      aria-label={isIcon ? `${HELP_TERMS[termId].name} 도움말` : undefined}
      onClick={reopen}
    >
      {isIcon ? '?' : children}
    </a>
  );
}
