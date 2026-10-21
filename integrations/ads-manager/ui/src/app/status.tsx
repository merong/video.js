import { ApiError } from '../api/client';
import { StatusMessage } from '../components';

/** One line of operation feedback for a screen area. */
export interface Notice {
  text: string;
  error: boolean;
}

export const IDLE: Notice = { text: '', error: false };

export function info(text: string): Notice {
  return { text, error: false };
}

export function failure(text: string): Notice {
  return { text, error: true };
}

export interface ErrorReport {
  message: Notice;
  conflict: boolean;
  /** Login expired or the session/token could not be verified; the shell offers a reconnect. */
  auth: boolean;
  /** String field messages of a 422 by request path (`target.id`); a screen links the ones its inputs show. */
  fields: Record<string, string>;
}

export function describeError(error: unknown): ErrorReport {
  const status = error instanceof ApiError ? error.status : 0;
  let text = error instanceof Error ? error.message : '요청을 처리하지 못했어요.';

  if (status === 409) {
    text =
      '다른 곳에서 초안이 변경됐어요. 현재 입력은 그대로 두었어요. 내용을 확인한 뒤 서버 초안을 다시 불러와 주세요.';
  } else if (status === 401) {
    text = '로그인이 만료됐어요. 현재 입력은 그대로 두었어요. 다시 로그인한 뒤 작업을 이어가 주세요.';
  } else if (status === 403) {
    text =
      '권한 또는 보안 토큰을 확인하지 못했어요. 연결을 다시 확인한 뒤 다시 시도해 주세요. 입력은 그대로 남아 있어요.';
  }

  // Field messages arrive from the host API; render only their string values.
  const entries = error instanceof ApiError ? Object.entries(error.fields) : [];
  // oxlint-disable-next-line anti-slop/no-runtime-typeof
  const fields = Object.fromEntries(entries.filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
  // Hosts often repeat the summary as the field message; each sentence is said once.
  const extra = [...new Set(Object.values(fields))].filter((message) => !text.includes(message));

  return {
    message: failure([text, ...extra].join(' ')),
    conflict: status === 409,
    auth: status === 401 || status === 403,
    fields,
  };
}

/** Live result line for one screen area; stays mounted so screen readers hear each change. */
export function Status({ id, status }: { id?: string | undefined; status: Notice }) {
  return (
    <StatusMessage id={id} tone={status.error ? 'bad' : 'info'}>
      {status.text}
    </StatusMessage>
  );
}
