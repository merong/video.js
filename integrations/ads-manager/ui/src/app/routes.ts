import type { HostKind } from '../api/actions';
import { isHelpTermId, termsFor } from '../help';
import { DEFAULT_PLAYER_PRESET, parsePlayerPreset } from '../player';

export type StandaloneMock = 'dashboard' | 'campaigns' | 'approvals' | 'reportV2' | 'settings' | 'newLineItem';
export type GnuboardMock = 'requests' | 'settings';

export type RouteView =
  | { kind: 'creatives' }
  | { kind: 'schedule' }
  /** Player presets with sub pages under `#/players/…` (contract 3.2). */
  | { kind: 'players' }
  /** Lecture progress and LMS link, `#/lms/progress` or `#/lms/settings` (ads-lms-spec 5). */
  | { kind: 'lms' }
  | { kind: 'stats' }
  /** Feature guide and term dictionary, `#/help[/<termId>]` (contract 3.1). A term the host hides opens the start page. */
  | { kind: 'help'; host: HostKind }
  /** Standalone report: working basic statistics followed by the v2 report mockup. */
  | { kind: 'reports' }
  | { kind: 'mock'; host: 'standalone'; screen: StandaloneMock }
  | { kind: 'mock'; host: 'gnuboard'; screen: GnuboardMock };

export interface RouteDef {
  id: string;
  label: string;
  /** Hidden routes are reached from a header action, not the menu. */
  nav: boolean;
  view: RouteView;
}

const standalone: RouteDef[] = [
  { id: 'dashboard', label: '대시보드', nav: true, view: { kind: 'mock', host: 'standalone', screen: 'dashboard' } },
  { id: 'campaigns', label: '캠페인', nav: true, view: { kind: 'mock', host: 'standalone', screen: 'campaigns' } },
  { id: 'creatives', label: '소재', nav: true, view: { kind: 'creatives' } },
  { id: 'schedule', label: '지면 편성', nav: true, view: { kind: 'schedule' } },
  { id: 'players', label: '플레이어', nav: true, view: { kind: 'players' } },
  { id: 'lms', label: '강의', nav: true, view: { kind: 'lms' } },
  { id: 'approvals', label: '승인함', nav: true, view: { kind: 'mock', host: 'standalone', screen: 'approvals' } },
  { id: 'reports', label: '리포트', nav: true, view: { kind: 'reports' } },
  { id: 'settings', label: '설정', nav: true, view: { kind: 'mock', host: 'standalone', screen: 'settings' } },
  {
    id: 'new-line-item',
    label: '집행 만들기',
    nav: false,
    view: { kind: 'mock', host: 'standalone', screen: 'newLineItem' },
  },
  { id: 'help', label: '도움말', nav: false, view: { kind: 'help', host: 'standalone' } },
];

const gnuboard: RouteDef[] = [
  { id: 'requests', label: '광고 요청', nav: true, view: { kind: 'mock', host: 'gnuboard', screen: 'requests' } },
  { id: 'house', label: '하우스 광고', nav: true, view: { kind: 'creatives' } },
  { id: 'schedule', label: '지면 편성', nav: true, view: { kind: 'schedule' } },
  { id: 'players', label: '플레이어', nav: true, view: { kind: 'players' } },
  { id: 'lms', label: '강의', nav: true, view: { kind: 'lms' } },
  { id: 'stats', label: '통계', nav: true, view: { kind: 'stats' } },
  { id: 'settings', label: '설정', nav: true, view: { kind: 'mock', host: 'gnuboard', screen: 'settings' } },
  { id: 'help', label: '도움말', nav: false, view: { kind: 'help', host: 'gnuboard' } },
];

export function routesFor(host: HostKind): RouteDef[] {
  return host === 'gnuboard' ? gnuboard : standalone;
}

/** The first working screen, so a fresh session lands where the player can be tested. */
export function defaultRoute(host: HostKind): string {
  return host === 'gnuboard' ? 'house' : 'creatives';
}

export interface HashLocation {
  id: string;
  /** Canonical sub path after `#/<id>/`, `''` for none. Only the players, lms and help menus have sub pages. */
  path: string;
}

/**
 * Reads `#/<id>[/<path>]`. An unknown menu falls back to `fallback`; an unknown sub path to the menu's first page. A
 * query (`?…`) and one trailing slash are ignored.
 */
export function locationFromHash(hash: string, routes: readonly RouteDef[], fallback: string): HashLocation {
  const [id = '', ...rest] = hash.replace(/^#\/?/u, '').replace(/\?.*$/su, '').replace(/\/$/u, '').split('/');
  const route = routes.find((candidate) => candidate.id === id);
  if (!route) return { id: fallback, path: '' };

  return { id, path: subPath(route.view, rest) };
}

function subPath(view: RouteView, rest: readonly string[]): string {
  if (view.kind === 'players') return playerPath(parsePlayerPath(rest.join('/')));

  if (view.kind === 'lms') return parseLmsPath(rest.join('/'));

  // An unknown term opens the help start page, like `#/help`.
  if (view.kind === 'help') {
    const termId = rest.length === 1 ? rest[0] : undefined;

    return isHelpTermId(termId) && termsFor(view.host).includes(termId) ? termId : '';
  }

  return '';
}

export function routeFromHash(hash: string, routes: readonly RouteDef[], fallback: string): string {
  return locationFromHash(hash, routes, fallback).id;
}

export function hrefFor(id: string, path = ''): string {
  return path ? `#/${id}/${path}` : `#/${id}`;
}

export type PlayerPage =
  | { page: 'list' }
  | { page: 'new' }
  | { page: 'edit'; presetId: string }
  | { page: 'setup' }
  | { page: 'options' };

// The preset parser owns the id rule (built-in ids or `p-…`), so the built-in list is not copied here.
const isPresetId = (id: string) => parsePlayerPreset({ ...DEFAULT_PLAYER_PRESET, id }).ok;

/** Parses the part after `#/players/`; anything unknown is the preset list. */
export function parsePlayerPath(path: string): PlayerPage {
  const [page, id, ...extra] = path.split('/');
  if (extra.length) return { page: 'list' };

  if ((page === 'new' || page === 'setup' || page === 'options') && id === undefined) return { page };

  if (page === 'edit' && id !== undefined && isPresetId(id)) return { page, presetId: id };

  return { page: 'list' };
}

export function playerPath(page: PlayerPage): string {
  return page.page === 'list' ? '' : page.page === 'edit' ? `edit/${page.presetId}` : page.page;
}

export function playerHref(page: PlayerPage): string {
  return hrefFor('players', playerPath(page));
}

export type LmsPage = 'progress' | 'settings';

/** Parses the part after `#/lms/`; anything unknown is the progress page, which is also the canonical empty path. */
export function parseLmsPath(path: string): LmsPage {
  return path === 'settings' ? 'settings' : 'progress';
}
