import { useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import { Button } from './Button';
import { cx } from './cx';
import { StatusMessage } from './StatusMessage';

export const COPY_DONE_TEXT = '복사했어요.';
export const COPY_FAILED_TEXT = '복사하지 못했어요. 코드를 직접 선택해 복사해 주세요.';

export interface CodeBlockProps {
  code: string;
  /** Title shown above the code; also names the code region and its copy button ("<label> 복사"). */
  label: string;
  /** Keeps `label` for screen readers only, when a heading right above already names the code. */
  hideLabel?: boolean | undefined;
  className?: string | undefined;
}

// `count` makes a new text node per copy, so a repeated result is announced again.
type CopyResult = { tone: 'good' | 'warn'; text: string; count: number } | null;

function selectContents(element: HTMLElement) {
  const selection = window.getSelection();
  if (!selection) return;

  const range = document.createRange();

  range.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(range);
}

/** Code that keeps its lines (scrolls sideways, never wraps) with a copy button and a polite copy result. */
export function CodeBlock({ code, label, hideLabel, className }: CodeBlockProps) {
  const titleId = useId();
  const buttonId = useId();
  const resultId = useId();
  const codeRef = useRef<HTMLPreElement>(null);

  const [result, setResult] = useState<CopyResult>(null);
  const [resultFor, setResultFor] = useState(code);

  // A result about older code would mislead.
  if (resultFor !== code) {
    setResultFor(code);
    setResult(null);
  }

  async function copy() {
    try {
      // `navigator.clipboard` is missing outside secure contexts; that TypeError lands in catch as well.
      await navigator.clipboard.writeText(code);
      setResult((last) => ({ tone: 'good', text: COPY_DONE_TEXT, count: (last?.count ?? 0) + 1 }));
    } catch {
      // Render the description before focus moves, so the region is read with it.
      flushSync(() => {
        setResult((last) => ({ tone: 'warn', text: COPY_FAILED_TEXT, count: (last?.count ?? 0) + 1 }));
      });

      const element = codeRef.current;

      if (element) {
        element.focus();
        selectContents(element);
      }
    }
  }

  return (
    <div className={cx('sa-codeblock', className)}>
      <div className="sa-codeblock-head">
        <span id={titleId} className={hideLabel ? 'sa-sr' : 'sa-codeblock-title'}>
          {label}
        </span>
        <Button
          size="sm"
          id={buttonId}
          aria-labelledby={`${titleId} ${buttonId}`}
          icon={
            <svg className="sa-ico" viewBox="0 0 16 16" aria-hidden="true">
              <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
              <path d="M10.5 3.5v-.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h.5" />
            </svg>
          }
          onClick={() => void copy()}
        >
          복사
        </Button>
      </div>
      {/* Focus lands here on failure; describing the region with the result keeps the polite message from being lost. */}
      <pre
        ref={codeRef}
        role="region"
        aria-labelledby={titleId}
        aria-describedby={result?.tone === 'warn' ? resultId : undefined}
        tabIndex={0}
      >
        <code>{code}</code>
      </pre>
      <StatusMessage id={resultId} tone={result?.tone}>
        {result && <span key={result.count}>{result.text}</span>}
      </StatusMessage>
    </div>
  );
}
