import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Session } from '../api/actions';
import { listCreatives } from '../api/actions';
import type { AdminApi } from '../api/client';
import type { Creative } from '../api/model';
import { safeUrl } from '../api/model';
import { Avatar, Button, ButtonLink, SideNav, type SideNavItem } from '../components';
import { HelpScreen, isHelpTermId, termHeadingId } from '../help';
import { mockScreens } from '../mocks';
import { CreativesScreen } from '../screens/CreativesScreen';
import { LmsScreen } from '../screens/LmsScreen';
import { PlayerSettingsScreen } from '../screens/PlayerSettingsScreen';
import { PlayersScreen } from '../screens/PlayersScreen';
import { ScheduleScreen } from '../screens/ScheduleScreen';
import { StatsScreen } from '../screens/StatsScreen';
import { useMediaQuery } from './media-query';
import { MenuIcon, NavIcon } from './nav-icons';
import {
  defaultRoute,
  hrefFor,
  locationFromHash,
  parseLmsPath,
  parsePlayerPath,
  type RouteDef,
  routesFor,
} from './routes';
import { describeError, failure, Status } from './status';
import { CloseIcon, PlusIcon } from './ui';
import {
  type RunOptions,
  type SetStatus,
  type Workspace as WorkspaceValue,
  WorkspaceContext,
} from './workspace-context';

export interface WorkspaceProps {
  hidden: boolean;
  api: AdminApi;
  session: Session;
  publicBase: string;
  run: (setStatus: SetStatus, task: () => Promise<void>, options?: RunOptions) => Promise<boolean>;
  busy: boolean;
  setDirty: (key: string, dirty: boolean) => void;
  onLogout: () => void;
  /** A 401 or 403 outside `run` (the lazy creative list load); the shell offers to reconnect. */
  onAuthError: () => void;
  banner: ReactNode;
}

export function Workspace({
  hidden,
  api,
  session,
  publicBase,
  run,
  busy,
  setDirty,
  onLogout,
  onAuthError,
  banner,
}: WorkspaceProps) {
  const host = session.capabilities.host;
  const routes = useMemo(() => routesFor(host), [host]);
  const { active, path, visited, activation } = useHashRoute(routes, defaultRoute(host));
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [creativesState, setCreativesState] = useState<CreativesState>('idle');
  const [listError, setListError] = useState('');
  const latestList = useRef(0);
  const firstRead = useRef(false);
  const listSession = useRef(session);
  // Only the creative and schedule screens read the list, so help, mocks and the player menu send no request.
  const needsCreatives = routes.some((route) => visited.has(route.id) && usesCreatives(route));
  const shownCreativesState = creativesState === 'idle' && needsCreatives ? 'loading' : creativesState;

  // Only the latest request lands, so a slow first load cannot overwrite the list a save just reloaded.
  // Effects call this directly: state changes only once the response is in.
  const fetchCreatives = useCallback(async () => {
    latestList.current += 1;
    const request = latestList.current;

    try {
      const items = await listCreatives(api);

      if (request === latestList.current) {
        setCreatives(items);
        setListError('');
        setCreativesState('ready');
      }

      return items;
    } catch (error) {
      if (request === latestList.current) {
        setListError(describeError(error).message.text);
        setCreativesState((state) => (state === 'ready' ? state : 'error'));
      }

      throw error;
    }
  }, [api]);

  // Screens reload from events, so a failed list shows as loading again right away.
  const reloadCreatives = useCallback(() => {
    setCreativesState((state) => (state === 'ready' ? state : 'loading'));
    return fetchCreatives();
  }, [fetchCreatives]);

  // A read needs no admin token, so it does not take the single-operation lock; an expired login still reconnects.
  const loadCreatives = useCallback(
    (read: () => Promise<Creative[]>) => {
      // oxlint-disable-next-line anti-slop/no-unknown-parameters -- whatever the failed read threw.
      read().catch((error: unknown) => {
        if (describeError(error).auth) onAuthError();
      });
    },
    [onAuthError]
  );

  // The first read starts once a screen that needs the list opens; until it lands the list counts as loading.
  useEffect(() => {
    if (!needsCreatives || firstRead.current) return;

    firstRead.current = true;
    loadCreatives(fetchCreatives);
  }, [needsCreatives, loadCreatives, fetchCreatives]);

  // Signing in again replaces the session; a list that failed before is read again then.
  useEffect(() => {
    if (listSession.current === session) return;

    listSession.current = session;

    if (needsCreatives && listError) loadCreatives(fetchCreatives);
  }, [session, needsCreatives, listError, loadCreatives, fetchCreatives]);

  // A help term link focuses its own term heading.
  usePageFocus(active.id, active.view.kind === 'help' ? path : '');

  const runInMain = useReturnFocus(run, busy, active.id);
  const menu = useDrawer();

  const workspace = useMemo<WorkspaceValue>(
    () => ({
      api,
      session,
      publicBase,
      creatives,
      creativesState: shownCreativesState,
      reloadCreatives,
      run: runInMain,
      busy,
      setDirty,
    }),
    [api, session, publicBase, creatives, shownCreativesState, reloadCreatives, runInMain, busy, setDirty]
  );

  return (
    <WorkspaceContext value={workspace}>
      <div className="aa-workspace sa-shell" hidden={hidden}>
        <SideMenu session={session} routes={routes} activeId={active.id} menu={menu} />
        {menu.open ? (
          <div className="sa-side-scrim" aria-hidden="true" onClick={() => menu.close(MENU_BUTTON_ID)} />
        ) : null}
        {/* While the drawer is open only the menu takes focus. */}
        <div className="sa-shell-main" inert={menu.open}>
          <TopBar session={session} active={active} busy={busy} onLogout={onLogout} menu={menu} />
          {banner}
          <main
            id={hidden ? undefined : 'aa-main'}
            className="sa-main aa-main"
            tabIndex={-1}
            inert={busy}
            aria-busy={busy}
            aria-label={active.label}
          >
            {listError && usesCreatives(active) ? (
              <div className="aa-global">
                <Status status={failure(`소재 목록을 불러오지 못했어요. ${listError}`)} />
                <Button size="sm" onClick={() => loadCreatives(reloadCreatives)}>
                  소재 목록 다시 불러오기
                </Button>
              </div>
            ) : null}
            {routes
              .filter((route) => visited.has(route.id))
              .map((route) => (
                <section key={route.id} className="aa-stack" hidden={route.id !== active.id} aria-label={route.label}>
                  <RouteView
                    route={route}
                    host={host}
                    path={route.id === active.id ? path : null}
                    activation={route.id === active.id ? activation : null}
                  />
                </section>
              ))}
          </main>
        </div>
      </div>
    </WorkspaceContext>
  );
}

type CreativesState = WorkspaceValue['creativesState'];

function usesCreatives(route: RouteDef): boolean {
  return route.view.kind === 'creatives' || route.view.kind === 'schedule';
}

function RouteView({
  route,
  host,
  path,
  activation,
}: {
  route: RouteDef;
  host: Session['capabilities']['host'];
  /** The active sub path; `null` while another menu is shown, so a hidden screen keeps its last page. */
  path: string | null;
  /** Changes each time this menu becomes active; `null` while another menu is shown. */
  activation: number | null;
}) {
  const titleId = `aa-title-${route.id}`;
  const view = route.view;

  switch (view.kind) {
    case 'creatives':
      return <CreativesScreen titleId={titleId} title={route.label} host={host} />;
    case 'schedule':
      return <ScheduleScreen titleId={titleId} title={route.label} activation={activation} />;
    case 'players':
      return (
        <PlayersScreen
          titleId={titleId}
          title={route.label}
          page={path === null ? null : parsePlayerPath(path)}
          activation={activation}
        />
      );
    case 'playerSettings':
      return <PlayerSettingsScreen titleId={titleId} title={route.label} activation={activation} />;
    case 'lms':
      return (
        <LmsScreen
          titleId={titleId}
          title={route.label}
          page={path === null ? null : parseLmsPath(path)}
          activation={activation}
        />
      );
    case 'stats':
      return <StatsScreen titleId={titleId} title={route.label} />;
    case 'help':
      // `path` is null while hidden, so coming back to the same term changes `termId` and focuses its heading again.
      return <HelpScreen host={host} termId={path || undefined} titleId={titleId} />;
    case 'reports':
      return (
        <>
          <StatsScreen titleId={titleId} title={route.label} section="기본 통계" />
          <mockScreens.standalone.reportV2 />
        </>
      );
    case 'mock': {
      // Mock screens draw their own title and mock badge, and never call the API (contract §3).
      const Mock = view.host === 'standalone' ? mockScreens.standalone[view.screen] : mockScreens.gnuboard[view.screen];

      return <Mock />;
    }
  }
}

const MENU_BUTTON_ID = 'aa-menu-button';
const SIDE_ID = 'aa-side';

interface Drawer {
  /** Below 960px the side menu is an off-canvas drawer. */
  drawer: boolean;
  open: boolean;
  show: () => void;
  /** Closes the drawer and focuses the element with `focusId`, if any. */
  close: (focusId?: string) => void;
}

function useDrawer(): Drawer {
  const drawer = useMediaQuery('(max-width: 960px)', false);
  const [shown, setShown] = useState(false);
  const focusAfter = useRef<string | undefined>(undefined);
  const open = drawer && shown;

  // A wide window has no drawer; narrowing it again starts closed.
  if (!drawer && shown) setShown(false);

  // Opening moves focus into the menu; closing returns it to where `close` asked.
  useEffect(() => {
    if (open) {
      const side = document.getElementById(SIDE_ID);

      (side?.querySelector<HTMLElement>('a[aria-current="page"]') ?? side?.querySelector<HTMLElement>('a'))?.focus();
      return;
    }

    const focusId = focusAfter.current;

    focusAfter.current = undefined;

    if (focusId) document.getElementById(focusId)?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      focusAfter.current = MENU_BUTTON_ID;
      setShown(false);
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const show = useCallback(() => setShown(true), []);
  const close = useCallback((focusId?: string) => {
    focusAfter.current = focusId;
    setShown(false);
  }, []);

  return { drawer, open, show, close };
}

function SideMenu({
  session,
  routes,
  activeId,
  menu,
}: {
  session: Session;
  routes: readonly RouteDef[];
  activeId: string;
  menu: Drawer;
}) {
  const gnuboard = session.capabilities.host === 'gnuboard';
  const name = session.displayName || '관리자';
  // A code point, not a UTF-16 unit, so a leading emoji or rare Hanja stays whole.
  const initial = Array.from(name)[0] ?? '관';
  const groups: { label: string; items: SideNavItem[] }[] = [];

  for (const route of routes) {
    if (!route.nav) continue;

    const item = {
      id: route.id,
      label: route.label,
      href: hrefFor(route.id),
      current: route.id === activeId,
      icon: <NavIcon id={route.id} />,
    };
    const last = groups.at(-1);

    if (last?.label === route.group) last.items.push(item);
    else groups.push({ label: route.group, items: [item] });
  }

  // The hash router takes over after the click; the current menu's own link would leave focus in the closed drawer.
  const navigate = (item: SideNavItem) => menu.close(item.current ? `aa-title-${item.id}` : undefined);

  return (
    <SideNav
      id={SIDE_ID}
      brand={gnuboard ? undefined : '솔애드'}
      tag={gnuboard ? '광고 관리' : '관리자'}
      navLabel={gnuboard ? '광고 관리 메뉴' : '주 메뉴'}
      groups={groups}
      open={menu.open}
      onClose={menu.drawer ? () => menu.close(MENU_BUTTON_ID) : undefined}
      onNavigate={menu.drawer ? navigate : undefined}
      footer={
        <>
          <Avatar initial={initial} label={`${name} · 관리자`} />
          <span className="sa-side-user" aria-hidden="true">
            <b>{name}</b>
            <small>관리자</small>
          </span>
        </>
      }
    />
  );
}

function TopBar({
  session,
  active,
  busy,
  onLogout,
  menu,
}: {
  session: Session;
  active: RouteDef;
  busy: boolean;
  onLogout: () => void;
  menu: Drawer;
}) {
  const { host, siteUrl, adminUrl } = session.capabilities;
  const gnuboard = host === 'gnuboard';
  // Only a window this page's opener created can be closed by script; otherwise the button would do nothing.
  const closable = gnuboard && Boolean(window.opener);

  return (
    <header className="sa-topbar">
      {menu.drawer ? (
        <button
          type="button"
          id={MENU_BUTTON_ID}
          className="sa-topbar-menu"
          aria-label="메뉴 열기"
          aria-expanded={menu.open}
          aria-controls={SIDE_ID}
          onClick={menu.show}
        >
          <MenuIcon />
        </button>
      ) : null}
      {/* The page title repeats this for screen readers; it shows where the page sits while the menu is hidden. */}
      <p className="sa-topbar-crumb" aria-hidden="true">
        <span>{active.group}</span>
        <b>{active.label}</b>
      </p>
      <div className="sa-topbar-r">
        <ButtonLink size="sm" href={hrefFor('help')} aria-current={active.id === 'help' ? 'page' : undefined}>
          도움말
        </ButtonLink>
        {gnuboard ? (
          <>
            {safeUrl(siteUrl) ? (
              <ButtonLink size="sm" href={siteUrl} target="_blank" rel="noopener">
                사이트 보기
              </ButtonLink>
            ) : null}
            {safeUrl(adminUrl) ? (
              <ButtonLink size="sm" href={adminUrl} target="_blank" rel="noopener">
                관리자
              </ButtonLink>
            ) : null}
          </>
        ) : (
          <ButtonLink
            size="sm"
            variant="accent"
            icon={<PlusIcon />}
            href={hrefFor('new-line-item')}
            aria-current={active.id === 'new-line-item' ? 'page' : undefined}
          >
            집행 만들기
          </ButtonLink>
        )}
        {gnuboard ? null : (
          <Button
            size="sm"
            disabledReason={busy ? '처리 중인 작업이 끝나면 로그아웃할 수 있어요.' : undefined}
            onClick={onLogout}
          >
            로그아웃
          </Button>
        )}
        {closable ? (
          <Button size="sm" icon={<CloseIcon />} aria-label="광고 관리 창 닫기" onClick={() => window.close()} />
        ) : null}
      </div>
    </header>
  );
}

interface HashRouteState {
  id: string;
  /** Canonical sub path; changing it alone is not a menu change. */
  path: string;
  /** Counts menu changes, so a screen can tell a fresh visit from the one it prepared something in. */
  activation: number;
  /** Menus opened so far stay mounted (hidden), so switching menus keeps their unsaved input. */
  visited: ReadonlySet<string>;
}

interface HashRoute {
  active: RouteDef;
  path: string;
  visited: ReadonlySet<string>;
  activation: number;
}

function useHashRoute(routes: readonly RouteDef[], fallback: string): HashRoute {
  const read = useCallback(() => locationFromHash(window.location.hash, routes, fallback), [routes, fallback]);
  const [state, setState] = useState<HashRouteState>(() => {
    const { id, path } = read();

    return { id, path, visited: new Set([id]), activation: 0 };
  });

  useEffect(() => {
    const sync = () => {
      const next = read();
      const href = hrefFor(next.id, next.path);

      // Keep a canonical hash so a reload returns to the same menu and page.
      if (window.location.hash !== href) history.replaceState(null, '', href);

      setState((current) => {
        if (current.id === next.id) return current.path === next.path ? current : { ...current, path: next.path };

        return {
          id: next.id,
          path: next.path,
          visited: current.visited.has(next.id) ? current.visited : new Set([...current.visited, next.id]),
          activation: current.activation + 1,
        };
      });
    };

    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, [read]);

  return {
    active: routes.find((route) => route.id === state.id) ?? routes[0]!,
    path: state.path,
    visited: state.visited,
    activation: state.activation,
  };
}

/**
 * Moves focus to the new page title after a menu change, and to the first title after sign-in. `termId` is the help
 * sub-path; a shown term keeps the focus `HelpScreen` gave its heading.
 */
function usePageFocus(id: string, termId: string) {
  const first = useRef(true);

  useEffect(() => {
    const initial = first.current;

    first.current = false;

    // Child effects run first: `HelpScreen` has already focused a term it shows. A term this host hides falls through.
    if (isHelpTermId(termId) && document.getElementById(termHeadingId(termId))) return;

    if (initial && document.activeElement && document.activeElement !== document.body) return;

    (document.getElementById(`aa-title-${id}`) ?? document.getElementById('aa-main'))?.focus();
  }, [id, termId]);
}

/**
 * Wraps `run` for the screens. While an operation runs the main area is inert, which drops focus to the page body;
 * afterwards focus goes back to the control that started it, or to the page title when that control is gone or
 * disabled. A screen that moved focus itself, such as to a field with an error, keeps it.
 */
function useReturnFocus(run: WorkspaceProps['run'], busy: boolean, activeId: string): WorkspaceProps['run'] {
  const pending = useRef<{ from: Element | null; shown: boolean } | null>(null);

  useEffect(() => {
    const request = pending.current;
    if (!request) return;

    if (busy) {
      request.shown = true;
      return;
    }

    // An operation that ended before it rendered never made the area inert.
    if (!request.shown) return;

    pending.current = null;

    if (document.activeElement && document.activeElement !== document.body) return;

    const { from } = request;
    const usable = from instanceof HTMLElement && from.isConnected && !from.matches(':disabled, [hidden] *');

    (usable ? from : document.getElementById(`aa-title-${activeId}`))?.focus();
  });

  return useCallback<WorkspaceProps['run']>(
    (setStatus, task, options) => {
      pending.current = { from: document.activeElement, shown: false };
      return run(setStatus, task, options);
    },
    [run]
  );
}
