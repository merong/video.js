// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ComponentType } from 'react';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vite-plus/test';

import { MOCK_BADGE_TEXT } from '../src/components';
import { mockScreens } from '../src/mocks';
import { MOCK_WRITE_REASON } from '../src/mocks/MockPage';

const screens: [string, ComponentType][] = [
  ...Object.entries(mockScreens.standalone).map(([key, Screen]): [string, ComponentType] => [
    `standalone.${key}`,
    Screen,
  ]),
  ...Object.entries(mockScreens.gnuboard).map(([key, Screen]): [string, ComponentType] => [`gnuboard.${key}`, Screen]),
];

/** View switches carry `data-mock-nav`; filter chips carry `aria-pressed`. Neither writes anything. */
function isNavigation(button: HTMLElement) {
  return button.hasAttribute('data-mock-nav') || button.hasAttribute('aria-pressed');
}

/** Every control that would write is disabled and points at a visible reason. */
function expectWritesDisabled() {
  const buttons = screen.queryAllByRole('button').filter((button) => !isNavigation(button));
  const controls = [...buttons, ...screen.queryAllByRole('switch'), ...screen.queryAllByRole('searchbox')];

  for (const control of controls) {
    const name = control.getAttribute('aria-label') ?? control.textContent ?? '';
    const reasonIds = control.getAttribute('aria-describedby')?.split(' ') ?? [];
    const reasons = reasonIds.map((id) => document.getElementById(id)?.textContent?.trim());

    expect(control, name).toHaveProperty('disabled', true);
    expect(reasons.some(Boolean), `${name} has no reason`).toBe(true);
  }
}

/** Data tables have a caption; item-value tables are named by `aria-label`. */
function expectCaptions(min: number) {
  const tables = screen.getAllByRole('table');
  const dataTables = tables.filter((table) => !table.classList.contains('sa-kv'));

  expect(dataTables.length).toBeGreaterThanOrEqual(min);

  for (const table of dataTables) expect(table.querySelector('caption')?.textContent?.trim()).toBeTruthy();

  for (const table of tables) {
    if (table.classList.contains('sa-kv')) expect(table.getAttribute('aria-label')).toBeTruthy();
  }
}

describe('mockScreens', () => {
  let fetchSpy: MockInstance<typeof globalThis.fetch>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    cleanup();
    window.location.hash = '';
  });

  it('keeps the contract keys', () => {
    expect(Object.keys(mockScreens.standalone)).toEqual([
      'dashboard',
      'campaigns',
      'approvals',
      'reportV2',
      'settings',
      'newLineItem',
    ]);
    expect(Object.keys(mockScreens.gnuboard)).toEqual(['requests', 'settings']);
  });

  it.each(screens)('%s shows the mock badge, calls no API, and disables writes', (_name, Screen) => {
    render(<Screen />);

    expect(screen.getByText(MOCK_BADGE_TEXT)).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
    expectWritesDisabled();
  });

  it('titles 집행 만들기 like the other unbuilt mock screens', () => {
    render(<mockScreens.standalone.newLineItem />);

    const head = screen.getByRole('heading', { level: 1, name: '집행 만들기' }).parentElement;

    expect(head?.querySelector('.sa-mock')?.textContent).toBe(MOCK_BADGE_TEXT);
    expect(screen.getByText('아직 만들지 않은 화면').closest('.sa-card')?.className).toBe('sa-card is-unbuilt');
  });

  it('treats 승인함 열기 as a write, not a view switch', () => {
    render(<mockScreens.standalone.dashboard />);

    const button = screen.getByRole('button', { name: '승인함 열기' });

    expect(isNavigation(button)).toBe(false);

    expect(button).toHaveProperty('disabled', true);
    expect(button.getAttribute('aria-describedby')).toBe(screen.getByText(MOCK_WRITE_REASON).id);
  });

  it('captions the dashboard table', () => {
    render(<mockScreens.standalone.dashboard />);

    expectCaptions(1);
    expect(screen.getByRole('table', { name: '최근 집행' })).toBeTruthy();
  });

  it('opens a campaign detail in place and goes back to the list', () => {
    window.location.hash = '#/campaigns';
    render(<mockScreens.standalone.campaigns />);

    expectCaptions(1);
    // Pinned so the button stays inside the card when the table scrolls sideways at 768px.
    expect(screen.getByRole('button', { name: '예시 캠페인 A 열기' }).closest('td')?.className).toBe('is-pinned');
    fireEvent.click(screen.getByRole('button', { name: '예시 캠페인 A 열기' }));

    const title = screen.getByRole('heading', { level: 1, name: '예시 캠페인 A' });

    expect(document.activeElement).toBe(title);
    expect(window.location.hash).toBe('#/campaigns');
    expect(screen.getByText(MOCK_BADGE_TEXT)).toBeTruthy();
    expect(screen.getByRole('table', { name: '예시 캠페인 A의 집행 (예시)' })).toBeTruthy();
    expect(screen.getAllByRole('switch')).toHaveLength(3);
    expectCaptions(1);
    expectWritesDisabled();
    expect(fetchSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '← 캠페인 목록' }));

    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: '캠페인' }));
    expect(window.location.hash).toBe('#/campaigns');
  });

  it('filters campaigns by status without leaving the list', () => {
    render(<mockScreens.standalone.campaigns />);

    const table = screen.getByRole('table', { name: '캠페인 목록 (예시)' });

    fireEvent.click(screen.getByRole('button', { name: /^승인 대기\s*1$/ }));

    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /^승인 대기\s*1$/ }).getAttribute('aria-pressed')).toBe('true');
  });

  it('labels GnuBoard request stages and filters by them', () => {
    render(<mockScreens.gnuboard.requests />);

    const table = screen.getByRole('table', { name: '광고 요청 목록 (예시)' });

    expectCaptions(1);
    expect(within(table).getAllByText('접수')).toHaveLength(2);
    expect(within(table).getByText('보완 요청')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^접수\s*2$/ }));

    expect(within(table).getAllByRole('row')).toHaveLength(3);
  });

  it('opens a request detail in place with its actions disabled', () => {
    window.location.hash = '#/requests';
    render(<mockScreens.gnuboard.requests />);

    fireEvent.click(screen.getByRole('button', { name: '요청 15 열기' }));

    const title = screen.getByRole('heading', { level: 1, name: '예시 동호회 정기 모임 안내' });

    expect(document.activeElement).toBe(title);
    expect(window.location.hash).toBe('#/requests');
    expect(screen.getByText(MOCK_BADGE_TEXT)).toBeTruthy();
    expect(screen.getByRole('table', { name: '요청서' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '승인하고 집행 만들기' })).toHaveProperty('disabled', true);
    expectCaptions(0);
    expectWritesDisabled();
    expect(fetchSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '← 광고 요청 목록' }));

    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: '광고 요청 관리' }));
    expect(window.location.hash).toBe('#/requests');
  });

  it('renders the v2 report as a section without a page title', () => {
    render(<mockScreens.standalone.reportV2 />);

    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    const section = screen.getByRole('region', { name: '리포트 v2' });

    expect(within(section).getByText(MOCK_BADGE_TEXT)).toBeTruthy();
    expect(within(section).getByRole('heading', { level: 3, name: '차원별 리포트' })).toBeTruthy();
  });

  it('names the planning document on every unimplemented screen', () => {
    const unbuilt = [
      [mockScreens.standalone.approvals, 'ads-admin-v2-spec.md §8.5'],
      [mockScreens.standalone.reportV2, 'ads-admin-v2-spec.md §8.6'],
      [mockScreens.standalone.settings, 'ads-admin-v2-spec.md §8.9'],
      [mockScreens.gnuboard.settings, 'ads-admin-gnuboard-spec.md §10.2'],
    ] as const;

    for (const [Screen, spec] of unbuilt) {
      const { unmount } = render(<Screen />);

      expect(screen.getByText((text) => text.includes(spec))).toBeTruthy();
      unmount();
    }
  });

  it('keeps API code out of the mock sources', () => {
    const sources = import.meta.glob<string>('../src/mocks/*.{ts,tsx}', {
      query: '?raw',
      import: 'default',
      eager: true,
    });

    expect(Object.keys(sources).length).toBeGreaterThan(0);

    for (const [file, source] of Object.entries(sources)) {
      expect(source, file).not.toMatch(/\bfetch\s*\(|from ['"][./]*api\b|XMLHttpRequest/);
    }
  });
});
