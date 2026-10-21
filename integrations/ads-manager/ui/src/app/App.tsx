import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';

import { type Bootstrap, loadBootstrap, login, logout, type Session, toSession } from '../api/actions';
import { type AdminApi, ApiError } from '../api/client';
import { safeUrl } from '../api/model';
import { Button, ButtonLink, Field, Input, Panel, TopNav } from '../components';
import { ConfirmProvider, useConfirm } from './confirm';
import { describeError, failure, IDLE, info, type Notice, Status } from './status';
import { Workspace } from './Workspace';
import type { RunOptions, SetStatus } from './workspace-context';

export interface AppProps {
  api: AdminApi;
  publicBase: string;
}

export function App(props: AppProps) {
  return (
    <ConfirmProvider>
      <AdminShell {...props} />
    </ConfirmProvider>
  );
}

function AdminShell({ api, publicBase }: AppProps) {
  const confirm = useConfirm();
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  // The last authenticated session stays mounted (hidden) after an expiry, so re-login keeps unsaved input.
  const [session, setSession] = useState<Session | null>(null);
  const [sessionKey, setSessionKey] = useState(0);
  const [globalStatus, setGlobalStatus] = useState<Notice>(info('관리자 연결을 확인하고 있어요.'));
  const [reconnect, setReconnect] = useState(false);
  // The first bootstrap holds the single-operation lock from the first render until it settles.
  const [busy, setBusy] = useState(true);
  const lock = useRef(true);
  const dirty = useRef(new Map<string, boolean>());

  const run = useCallback(
    async (setStatus: SetStatus, task: () => Promise<void>, options: RunOptions = {}): Promise<boolean> => {
      if (lock.current) return false;

      lock.current = true;
      setBusy(true);
      setStatus(info('처리하고 있어요…'));

      try {
        await task();
        return true;
      } catch (error) {
        const report = describeError(error);

        setStatus(report.message);

        if (report.auth) setReconnect(true);

        options.onError?.(report);
        return false;
      } finally {
        lock.current = false;
        setBusy(false);
      }
    },
    []
  );

  const apply = useCallback((data: Bootstrap) => {
    const next = toSession(data);

    setBoot(data);
    setReconnect(false);

    if (next) {
      setSession(next);
      setGlobalStatus(IDLE);
      return;
    }

    setGlobalStatus(
      info(
        data.capabilities.host === 'standalone'
          ? '관리자 계정으로 로그인해 주세요.'
          : '사이트 관리자 권한으로 로그인한 뒤 다시 열어 주세요.'
      )
    );
  }, []);

  const refresh = useCallback(async () => apply(await loadBootstrap(api)), [api, apply]);

  const markReconnect = useCallback(() => setReconnect(true), []);

  const connect = useCallback(async () => {
    const ok = await run(setGlobalStatus, refresh);

    if (!ok) setReconnect(true);
  }, [run, refresh]);

  useEffect(() => {
    loadBootstrap(api)
      .then(apply)
      .catch((error: unknown) => {
        setGlobalStatus(describeError(error).message);
        setReconnect(true);
      })
      .finally(() => {
        lock.current = false;
        setBusy(false);
      });
  }, [api, apply]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (![...dirty.current.values()].some(Boolean)) return;

      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const setDirty = useCallback((key: string, value: boolean) => {
    dirty.current.set(key, value);
  }, []);

  const signOut = useCallback(async () => {
    // The button is disabled while busy; this also covers a click that lands before the re-render.
    if (lock.current) return;

    const unsaved = [...dirty.current.values()].some(Boolean);

    if (
      unsaved &&
      !(await confirm({
        title: '로그아웃할까요?',
        body: '저장하지 않은 변경이 있어요. 로그아웃하면 입력한 내용이 사라져요.',
        confirmLabel: '로그아웃',
        danger: true,
      }))
    ) {
      return;
    }

    void run(setGlobalStatus, async () => {
      await logout(api);
      dirty.current.clear();
      setSession(null);
      setSessionKey((key) => key + 1);
      await refresh();
    });
  }, [api, confirm, run, refresh]);

  const authenticated = boot?.authenticated === true && session !== null;
  const host = boot?.capabilities.host ?? session?.capabilities.host ?? 'standalone';

  return (
    <div className="aa-app">
      <Button size="sm" className="aa-skip" onClick={() => document.getElementById('aa-main')?.focus()}>
        본문으로 이동
      </Button>
      {session ? (
        <Workspace
          key={sessionKey}
          hidden={!authenticated}
          api={api}
          session={session}
          publicBase={publicBase}
          run={run}
          busy={busy}
          setDirty={setDirty}
          onLogout={() => void signOut()}
          onAuthError={markReconnect}
          banner={<GlobalStatus status={globalStatus} reconnect={reconnect} onReconnect={connect} />}
        />
      ) : null}
      {authenticated ? null : (
        <>
          <TopNav
            brand={host === 'gnuboard' ? undefined : '솔애드'}
            tag={host === 'gnuboard' ? '광고 관리' : '관리자'}
            items={[]}
          />
          <GlobalStatus status={globalStatus} reconnect={reconnect} onReconnect={connect} />
          <main id="aa-main" className="sa-main aa-main" tabIndex={-1} inert={busy} aria-busy={busy}>
            {boot ? <LoginPanel boot={boot} api={api} run={run} onSignedIn={refresh} /> : null}
          </main>
        </>
      )}
    </div>
  );
}

function GlobalStatus({
  status,
  reconnect,
  onReconnect,
}: {
  status: Notice;
  reconnect: boolean;
  onReconnect: () => void;
}) {
  if (!status.text && !reconnect) return null;

  return (
    <div className="aa-global">
      <Status status={status} />
      {reconnect ? (
        <Button size="sm" onClick={onReconnect}>
          연결 다시 확인
        </Button>
      ) : null}
    </div>
  );
}

const WRONG_LOGIN = '아이디나 비밀번호가 맞지 않아요. 다시 입력해 주세요.';

function LoginPanel({
  boot,
  api,
  run,
  onSignedIn,
}: {
  boot: Bootstrap;
  api: AdminApi;
  run: (setStatus: SetStatus, task: () => Promise<void>) => Promise<boolean>;
  onSignedIn: () => Promise<void>;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<Notice>(IDLE);
  const standalone = boot.capabilities.host === 'standalone';
  const loginUrl = boot.capabilities.loginUrl;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(setStatus, async () => {
      let signedIn;

      try {
        signedIn = await login(api, username.trim(), password);
      } catch (error) {
        // A 401 here is a wrong username or password, not an expired login, so there is nothing to reconnect.
        if (error instanceof ApiError && error.status === 401) throw new Error(WRONG_LOGIN);

        throw error;
      }

      if (!signedIn) throw new Error('로그인하지 못했어요. 계정을 확인해 주세요.');

      setPassword('');
      setStatus(IDLE);
      await onSignedIn();
    });
  };

  const title = standalone ? '관리자 로그인' : '사이트 관리자 로그인';
  const description = '소재를 등록하고, 지면 편성을 게시하고, 재생 결과를 확인해요.';

  if (!standalone) {
    return (
      <Panel className="aa-login" title={title} description={description}>
        {safeUrl(loginUrl) ? (
          <ButtonLink variant="primary" href={loginUrl}>
            사이트 관리자 로그인
          </ButtonLink>
        ) : (
          <Status
            status={failure(
              '사이트 로그인 주소가 설정되지 않았어요. 사이트에서 관리자로 로그인한 뒤 다시 열어 주세요.'
            )}
          />
        )}
      </Panel>
    );
  }

  return (
    <Panel
      className="aa-login"
      title={title}
      description={description}
      onSubmit={submit}
      footer={
        <Button type="submit" variant="primary">
          로그인
        </Button>
      }
    >
      <Field label="아이디">
        <Input
          name="username"
          autoComplete="username"
          required
          maxLength={128}
          value={username}
          onChange={(event) => setUsername(event.currentTarget.value)}
        />
      </Field>
      <Field label="비밀번호">
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.currentTarget.value)}
        />
      </Field>
      <Status status={status} />
    </Panel>
  );
}
