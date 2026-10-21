// @vitest-environment jsdom
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  ActivityLog,
  type AdStatus,
  Button,
  ButtonLink,
  Card,
  Check,
  Chip,
  ChipGroup,
  ChipLink,
  ALPHA_COLOR_FORMAT_ERROR,
  COLOR_FORMAT_ERROR,
  ColorField,
  CodeBlock,
  COPY_DONE_TEXT,
  COPY_FAILED_TEXT,
  DataTable,
  Dialog,
  DisabledReason,
  Disclosure,
  Field,
  Fieldset,
  FileInput,
  Input,
  KeyValue,
  KpiRow,
  KpiStat,
  MOCK_BADGE_TEXT,
  MockBadge,
  Note,
  Panel,
  PresetMark,
  Progress,
  SectionNav,
  type SectionNavItem,
  Segmented,
  Select,
  STATUS_LABELS,
  StatusBadge,
  StatusMessage,
  Stepper,
  SubNav,
  type SubNavItem,
  SwitchList,
  Textarea,
  TierTag,
  TodoBanner,
  Toggle,
  TopNav,
  type TopNavItem,
  UnimplementedCard,
} from '../src/components';

afterEach(cleanup);

describe('TopNav', () => {
  const items = [
    { id: 'requests', label: '광고 요청', href: '#requests', count: 3 },
    { id: 'house', label: '하우스 광고', href: '#house', current: true },
    { id: 'settings', label: '설정', href: '#settings', count: 0 },
  ];

  it('marks the current item and shows waiting counts', () => {
    render(<TopNav brand="한빛 커뮤니티" tag="광고 관리" items={items} navLabel="광고 관리 메뉴" />);

    const nav = screen.getByRole('navigation', { name: '광고 관리 메뉴' });

    expect(within(nav).getByRole('link', { name: '하우스 광고' }).getAttribute('aria-current')).toBe('page');
    expect(
      within(nav)
        .getByRole('link', { name: /^광고 요청\s*3\s*건$/ })
        .getAttribute('aria-current')
    ).toBeNull();
    expect(within(nav).getByRole('link', { name: '설정' }).querySelector('b')).toBeNull();
    expect(screen.getByText('광고 관리').tagName).toBe('EM');
  });

  it('shows only the tag as plain text without a brand', () => {
    const { container } = render(<TopNav tag="광고 관리" items={items} />);

    expect(container.querySelector('.sa-logo')?.textContent).toBe('광고 관리');
    expect(container.querySelector('.sa-logo em')).toBeNull();
  });

  it('renders the actions area and hands plain clicks to onNavigate', () => {
    const onNavigate = vi.fn((_item: TopNavItem, event: { preventDefault: () => void }) => event.preventDefault());

    render(
      <TopNav
        brand="솔애드"
        tag="관리자"
        items={items}
        onNavigate={onNavigate}
        actions={<button type="button">창 닫기</button>}
      />
    );

    fireEvent.click(screen.getByRole('link', { name: '하우스 광고' }));
    fireEvent.click(screen.getByRole('link', { name: '설정' }), { ctrlKey: true });

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate.mock.calls[0]?.[0]).toMatchObject({ id: 'house' });
    expect(screen.getByRole('button', { name: '창 닫기' }).closest('.sa-top-r')).not.toBeNull();
  });
});

describe('Button', () => {
  it('maps variants and the small size to sa-btn classes', () => {
    render(
      <>
        <Button variant="primary">저장</Button>
        <Button variant="accent" size="sm">
          집행 만들기
        </Button>
        <Button variant="danger">반려</Button>
      </>
    );

    expect(screen.getByRole('button', { name: '저장' }).className).toBe('sa-btn is-primary');
    expect(screen.getByRole('button', { name: '집행 만들기' }).className).toBe('sa-btn is-lime is-sm');
    expect(screen.getByRole('button', { name: '반려' }).className).toBe('sa-btn is-danger');
    expect(screen.getByRole('button', { name: '저장' }).getAttribute('type')).toBe('button');
  });

  it('disables the button and describes it with the reason', () => {
    render(<Button disabledReason="목업 화면이라 저장할 수 없어요.">저장</Button>);

    const button = screen.getByRole('button', { name: '저장' });

    expect(button).toHaveProperty('disabled', true);
    expect(button.getAttribute('aria-describedby')).toBe(screen.getByText('목업 화면이라 저장할 수 없어요.').id);
  });
});

describe('ButtonLink', () => {
  it('renders a link with button classes', () => {
    render(
      <ButtonLink href="/" size="sm" target="_blank" rel="noopener">
        사이트 보기
      </ButtonLink>
    );

    expect(screen.getByRole('link', { name: '사이트 보기' }).className).toBe('sa-btn is-sm');
  });

  it('drops the address of a blocked link but keeps it focusable and ignores presses', () => {
    const onClick = vi.fn();

    render(
      <>
        <ButtonLink href="/demo" target="_blank" aria-disabled="true" aria-describedby="why" onClick={onClick}>
          데모에서 열기
        </ButtonLink>
        <span id="why">저장하면 열 수 있어요.</span>
      </>
    );

    const link = screen.getByRole('link', { name: '데모에서 열기' });

    expect(link.hasAttribute('href')).toBe(false);
    expect(link.hasAttribute('target')).toBe(false);
    expect(link.getAttribute('role')).toBe('link');
    expect(link.tabIndex).toBe(0);
    expect(link.getAttribute('aria-describedby')).toBe('why');
    expect(fireEvent.keyDown(link, { key: 'Enter' })).toBe(false);
    expect(fireEvent.click(link)).toBe(false);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('Field', () => {
  it('puts labelAside after the label, out of the control name and description', () => {
    render(
      <Field label="스킵 대기" labelAside={<a href="#/help/skip-offset">스킵 대기 도움말</a>} help="초 단위">
        <Input />
      </Field>
    );

    const input = screen.getByRole('textbox', { name: '스킵 대기' });
    const label = document.querySelector('label');
    const aside = screen.getByRole('link', { name: '스킵 대기 도움말' });

    expect(label?.nextElementSibling).toBe(aside);
    expect(label?.contains(aside)).toBe(false);
    expect(input.getAttribute('aria-describedby')).toBe(screen.getByText('초 단위').id);
  });

  it('links the label and help to an input', () => {
    render(
      <Field label="노출 목표" help="지금까지 102,300">
        <Input numeric defaultValue="300,000" />
      </Field>
    );

    const input = screen.getByLabelText('노출 목표');

    expect(input.className).toBe('sa-input is-num');
    expect(input.getAttribute('aria-describedby')).toBe(screen.getByText('지금까지 102,300').id);
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });

  it('marks errors invalid and lists the error before the help', () => {
    const { container } = render(
      <Field label="종료 일시" help="캠페인 기간 안에서 골라요." error="11.30 이전으로 바꿔 주세요.">
        <Input />
      </Field>
    );

    const input = screen.getByLabelText('종료 일시');
    const error = screen.getByText('11.30 이전으로 바꿔 주세요.');
    const help = screen.getByText('캠페인 기간 안에서 골라요.');

    expect(container.firstElementChild?.className).toBe('sa-field is-error');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe(`${error.id} ${help.id}`);
  });

  it('shows a warning only while there is no error', () => {
    const { container } = render(
      <Field label="점유율" warning="합계가 110%예요.">
        <Input />
      </Field>
    );

    expect(container.firstElementChild?.className).toBe('sa-field is-warn');
    expect(screen.getByLabelText('점유율').getAttribute('aria-invalid')).toBeNull();
  });

  it('wires select, textarea and file controls the same way', () => {
    render(
      <>
        <Field label="스킵" error="스킵 정책을 골라 주세요.">
          <Select>
            <option>5초 후 스킵</option>
          </Select>
        </Field>
        <Field label="답변" help="요청자에게 그대로 보여요.">
          <Textarea />
        </Field>
        <Field label="소재 파일" help="MP4, WebM">
          <FileInput accept="video/*" />
        </Field>
      </>
    );

    expect(screen.getByLabelText('스킵').tagName).toBe('SELECT');
    expect(screen.getByLabelText('스킵').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('답변').tagName).toBe('TEXTAREA');
    expect(screen.getByLabelText('답변').getAttribute('aria-describedby')).toBe(
      screen.getByText('요청자에게 그대로 보여요.').id
    );
    expect(screen.getByLabelText('소재 파일').getAttribute('type')).toBe('file');
  });
});

describe('Check', () => {
  it('labels a checkbox or radio', () => {
    render(
      <Fieldset legend="위치" help="여러 개 고를 수 있어요.">
        <Check label="프리롤" defaultChecked />
        <Check type="radio" name="use" label="받음" />
      </Fieldset>
    );

    expect(screen.getByRole('group', { name: '위치' }).getAttribute('aria-describedby')).toBe(
      screen.getByText('여러 개 고를 수 있어요.').id
    );
    expect(screen.getByRole('checkbox', { name: '프리롤' })).toHaveProperty('checked', true);
    expect(screen.getByRole('radio', { name: '받음' })).toBeTruthy();
  });
});

describe('Fieldset', () => {
  it('puts legendAside after the legend, out of the group name and description', () => {
    render(
      <Fieldset
        legend="위치"
        legendAside={<a href="#/help/ad-break">광고 구간 도움말</a>}
        help="여러 개 고를 수 있어요."
      >
        <Check label="프리롤" />
      </Fieldset>
    );

    const group = screen.getByRole('group', { name: '위치' });
    const legend = group.querySelector('legend');
    const aside = screen.getByRole('link', { name: '광고 구간 도움말' });

    expect(group.firstElementChild).toBe(legend);
    expect(legend?.nextElementSibling?.contains(aside)).toBe(true);
    expect(legend?.contains(aside)).toBe(false);
    expect(group.classList.contains('has-aside')).toBe(true);
    expect(group.getAttribute('aria-describedby')).toBe(screen.getByText('여러 개 고를 수 있어요.').id);
  });

  it('leaves the plain layout without legendAside', () => {
    render(
      <Fieldset legend="위치">
        <Check label="프리롤" />
      </Fieldset>
    );

    const group = screen.getByRole('group', { name: '위치' });

    expect(group.classList.contains('has-aside')).toBe(false);
    expect(group.querySelector('.sa-fieldset-aside')).toBeNull();
  });
});

describe('Toggle', () => {
  function Controlled() {
    const [on, setOn] = useState(false);

    return <Toggle checked={on} onCheckedChange={setOn} label="프리롤 보장" />;
  }

  it('is a switch that flips from the button and its label', () => {
    render(<Controlled />);

    const toggle = screen.getByRole('switch', { name: '프리롤 보장' });

    expect(toggle.getAttribute('aria-checked')).toBe('false');

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('true');

    fireEvent.click(screen.getByText('프리롤 보장'));
    expect(toggle.getAttribute('aria-checked')).toBe('false');
  });

  it('does not change while disabled', () => {
    const onCheckedChange = vi.fn();

    render(<Toggle checked={false} onCheckedChange={onCheckedChange} aria-label="미드롤" disabled />);

    fireEvent.click(screen.getByRole('switch', { name: '미드롤' }));
    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});

describe('Chip', () => {
  it('reports its pressed state and count', () => {
    render(
      <ChipGroup label="상태 필터">
        <Chip pressed count={5}>
          전체
        </Chip>
        <Chip pressed={false}>진행</Chip>
      </ChipGroup>
    );

    const group = screen.getByRole('group', { name: '상태 필터' });

    expect(
      within(group)
        .getByRole('button', { name: /^전체\s*5$/ })
        .getAttribute('aria-pressed')
    ).toBe('true');
    expect(within(group).getByRole('button', { name: '진행' }).getAttribute('aria-pressed')).toBe('false');
  });
});

describe('ChipGroup', () => {
  it('adds the weekday shape', () => {
    render(
      <ChipGroup label="요일" days>
        <Chip pressed>월</Chip>
      </ChipGroup>
    );

    expect(screen.getByRole('group', { name: '요일' }).className).toBe('sa-chips is-days');
  });
});

describe('ChipLink', () => {
  it('marks the current tab', () => {
    render(
      <ChipLink href="#all" current count={18}>
        전체
      </ChipLink>
    );

    expect(screen.getByRole('link', { name: /^전체\s*18$/ }).getAttribute('aria-current')).toBe('page');
  });
});

describe('StatusBadge', () => {
  it('names all nine statuses', () => {
    const statuses: AdStatus[] = [
      'draft',
      'pending',
      'scheduled',
      'active',
      'paused',
      'done',
      'under',
      'rejected',
      'archived',
    ];

    render(
      <>
        {statuses.map((status) => (
          <StatusBadge key={status} status={status} />
        ))}
      </>
    );

    expect(Object.keys(STATUS_LABELS)).toEqual(statuses);

    for (const status of statuses) {
      expect(screen.getByText(STATUS_LABELS[status]).getAttribute('data-st')).toBe(status);
    }
  });

  it('accepts a host-specific label on the same color', () => {
    render(<StatusBadge status="paused" label="보완 요청" />);

    expect(screen.getByText('보완 요청').getAttribute('data-st')).toBe('paused');
  });
});

describe('TierTag', () => {
  it('renders the tier class and name', () => {
    render(<TierTag tier="guaranteed" />);

    expect(screen.getByText('보장').className).toBe('sa-tag is-guaranteed');
  });
});

interface CssRule {
  selectors: string[];
  /** `prop: value`, whitespace collapsed. */
  declarations: string[];
}

/**
 * Innermost rules of design/components/bundle.css, including those inside `@media`. jsdom does no layout, so rules
 * stand in.
 */
const BUNDLE_RULES: CssRule[] = [
  ...readFileSync(resolve(import.meta.dirname, '../../../../design/components/bundle.css'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .matchAll(/([^{}]+)\{([^{}]*)\}/gu),
].map(([, selectors = '', body = '']) => ({
  selectors: selectors.split(',').map((selector) => selector.trim()),
  declarations: body
    .split(';')
    .map((declaration) => declaration.trim().replace(/\s+/gu, ' '))
    .filter(Boolean),
}));

function declarationsFor(selector: string): string[] {
  return BUNDLE_RULES.filter((rule) => rule.selectors.includes(selector)).flatMap((rule) => rule.declarations);
}

describe('bundle.css', () => {
  it('shrinks .sa-sr to a clipped 1px box with no margin, padding or border', () => {
    expect(declarationsFor('.sa-sr')).toEqual(
      expect.arrayContaining([
        'position: absolute',
        'width: 1px',
        'height: 1px',
        'margin: -1px',
        'padding: 0',
        'overflow: hidden',
        'clip-path: inset(50%)',
        'border: 0',
        'white-space: nowrap',
      ])
    );
    // `.sa-table caption` padding outranks `.sa-sr`, so a hidden caption needs its own reset.
    expect(declarationsFor('.sa-table caption.sa-sr')).toContain('padding: 0');
  });

  // An absolute `.sa-sr` escapes a scroll area that is not positioned and widens the page (390px 소재 화면, 560px).
  it('makes every horizontal scroll area the containing block of what it scrolls', () => {
    const scrollers = BUNDLE_RULES.filter((rule) =>
      rule.declarations.some((declaration) => /^overflow(-x)?: (auto|scroll)$/u.test(declaration))
    ).flatMap((rule) => rule.selectors);

    expect(scrollers).toEqual(expect.arrayContaining(['.sa-scroll', '.sa-codeblock pre', '.sa-subnav', '.sa-nav']));

    for (const selector of scrollers) {
      const positioned = declarationsFor(selector).some((declaration) =>
        /^position: (relative|absolute|sticky|fixed)$/u.test(declaration)
      );

      expect(positioned, selector).toBe(true);
    }
  });
});

describe('DataTable', () => {
  const columns = [
    { key: 'title', header: '제목', render: (row: { id: number; title: string; views: string }) => row.title },
    { key: 'views', header: '노출', numeric: true, render: (row: { views: string }) => row.views },
    { key: 'edit', header: '관리', hideHeader: true, render: () => <a href="#edit">수정</a> },
  ];
  const rows = [
    { id: 1, title: '회원 가입 안내', views: '48,210' },
    { id: 2, title: '앱 다운로드 배너', views: '12,940' },
  ];

  it('names the table and its scroll area with the caption', () => {
    render(
      <DataTable
        caption="하우스 광고"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        dense
        isSelected={(row) => row.id === 2}
        empty={{ title: '등록된 하우스 광고가 없어요' }}
      />
    );

    const table = screen.getByRole('table', { name: '하우스 광고' });

    expect(screen.getByRole('region', { name: '하우스 광고' }).getAttribute('tabindex')).toBe('0');
    expect(table.closest('.sa-card')?.className).toBe('sa-card is-flush sa-dense');
    expect(within(table).getByRole('cell', { name: '48,210' }).className).toBe('num');
    expect(within(table).getByRole('columnheader', { name: '관리' }).querySelector('.sa-sr')).not.toBeNull();
    expect(within(table).getAllByRole('row')[2]?.className).toBe('is-selected');
  });

  it('pins the last column with pinEnd', () => {
    render(
      <DataTable
        caption="캠페인"
        columns={[
          { key: 'title', header: '제목', render: (row: { id: number; title: string }) => row.title },
          {
            key: 'open',
            header: '동작',
            hideHeader: true,
            pinEnd: true,
            render: () => <button type="button">열기</button>,
          },
        ]}
        rows={[{ id: 1, title: '예시 캠페인 A' }]}
        rowKey={(row) => row.id}
        empty={{ title: '캠페인이 없어요' }}
      />
    );

    const table = screen.getByRole('table', { name: '캠페인' });

    expect(within(table).getByRole('columnheader', { name: '동작' }).className).toBe('is-pinned');
    expect(screen.getByRole('button', { name: '열기' }).closest('td')?.className).toBe('is-pinned');
    expect(within(table).getByRole('cell', { name: '예시 캠페인 A' }).getAttribute('class')).toBeNull();
  });

  it('shows one full-width row when there are no rows', () => {
    render(
      <DataTable
        caption="광고 요청"
        hideCaption
        columns={columns}
        rows={[]}
        rowKey={(row) => row.id}
        empty={{ title: '조건에 맞는 요청이 없어요', description: '필터를 바꿔 보세요.' }}
      />
    );

    const cell = screen.getByRole('cell', { name: /^조건에 맞는 요청이 없어요\s*필터를 바꿔 보세요\.$/ });

    expect(cell.getAttribute('colspan')).toBe('3');
    expect(screen.getByText('광고 요청').className).toBe('sa-sr');
  });
});

describe('KpiRow', () => {
  it('sets the column count and hero size', () => {
    render(
      <KpiRow label="오늘 요약" hero>
        <KpiStat label="노출" value="31,320" delta={{ text: '▲ 4.2%', tone: 'good', compare: '어제 30,060' }} />
        <KpiStat label="오류" value="27" note="어제 18" />
      </KpiRow>
    );

    const row = screen.getByRole('region', { name: '오늘 요약' });

    expect(row.className).toBe('sa-card sa-kpis is-hero');
    expect(row.style.getPropertyValue('--n')).toBe('2');
  });
});

describe('KpiStat', () => {
  it('shows the delta with its comparison', () => {
    render(<KpiStat label="클릭률" value="2.11%" delta={{ text: '▼ 0.08%p', tone: 'bad', compare: '어제 2.19%' }} />);

    expect(screen.getByText('▼ 0.08%p').className).toBe('sa-delta is-bad');
    expect(screen.getByText('어제 2.19%').tagName).toBe('EM');
  });
});

describe('Progress', () => {
  it('describes delivery against the expected pace', () => {
    const { container } = render(<Progress value={64} expected={65} />);

    expect(screen.getByRole('img', { name: '진도 64.0% · 기대 65.0%' })).toBeTruthy();
    expect(container.querySelector('.sa-bar > b')).not.toBeNull();
  });

  it('turns red when behind and drops the marker without an expected value', () => {
    const { container } = render(<Progress value={91.6} behind caption="91.6% · 미달" label="진도 91.6% · 미달" />);

    expect(container.firstElementChild?.className).toBe('sa-progress is-behind');
    expect(container.querySelector('.sa-bar > b')).toBeNull();
    expect(screen.getByText('91.6% · 미달')).toBeTruthy();
  });
});

describe('Stepper', () => {
  const steps = [
    { id: 'basic', label: '기본', state: 'done' as const },
    { id: 'period', label: '기간', state: 'current' as const },
    { id: 'creative', label: '소재 연결', state: 'error' as const },
  ];

  it('marks done, current and error steps', () => {
    render(<Stepper label="집행 편집 단계" steps={steps} />);

    const list = screen.getByRole('list', { name: '집행 편집 단계' });
    const [done, current, error] = within(list).getAllByRole('listitem');

    expect(list.className).toBe('sa-steps');
    expect(done?.className).toBe('is-done');
    expect(current?.getAttribute('aria-current')).toBe('step');
    expect(error?.textContent).toBe('소재 연결 (확인 필요)');
  });

  it('renders the one-line flow', () => {
    render(<Stepper label="요청 처리 단계" steps={steps} variant="flow" />);

    expect(screen.getByRole('list', { name: '요청 처리 단계' }).className).toBe('sa-flow');
  });
});

describe('TodoBanner', () => {
  it('lists to-dos with counts and marks failures', () => {
    render(
      <TodoBanner
        label="오늘의 할 일"
        title="확인할 일이 4건 있어요"
        actions={<Button variant="accent">승인함 열기</Button>}
        items={[
          { id: 'review', title: '소재 심사 대기', detail: '가을_15s v3 외 2건', count: 3 },
          { id: 'rejected', title: '내 제출 중 반려', count: 1, bad: true },
        ]}
      />
    );

    const banner = screen.getByRole('region', { name: '오늘의 할 일' });
    const [review, rejected] = within(banner).getAllByRole('listitem');

    expect(review?.textContent).toBe('소재 심사 대기가을_15s v3 외 2건3건');
    expect(rejected?.className).toBe('is-bad');
    expect(within(banner).getByRole('heading', { name: '확인할 일이 4건 있어요' })).toBeTruthy();
  });
});

describe('Card', () => {
  it('is a section named by its title', () => {
    render(
      <Card title="처리 기록" actions={<Button size="sm">전체 보기</Button>}>
        내용
      </Card>
    );

    expect(screen.getByRole('region', { name: '처리 기록' }).className).toBe('sa-card');
  });

  it('puts a flush card title in a toolbar', () => {
    render(
      <Card title="요청서" flush dense>
        표
      </Card>
    );

    const card = screen.getByRole('region', { name: '요청서' });

    expect(card.className).toBe('sa-card is-flush sa-dense');
    expect(screen.getByRole('heading', { name: '요청서' }).parentElement?.className).toBe('sa-toolbar');
  });
});

describe('Panel', () => {
  it('becomes a named form when it handles submit', () => {
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());

    render(
      <Panel
        title="새 하우스 광고"
        description="바로 노출돼요."
        onSubmit={onSubmit}
        footer={<Button type="submit">등록</Button>}
      >
        <Field label="이름">
          <Input />
        </Field>
      </Panel>
    );

    const form = screen.getByRole('form', { name: '새 하우스 광고' });

    fireEvent.click(within(form).getByRole('button', { name: '등록' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

describe('Dialog', () => {
  function Harness({ onClose }: { onClose: () => void }) {
    const [open, setOpen] = useState(false);

    return (
      <>
        <Button onClick={() => setOpen(true)}>반려</Button>
        <Dialog
          open={open}
          title="요청을 반려할까요?"
          onClose={() => {
            setOpen(false);
            onClose();
          }}
          footer={<Button variant="danger">반려 확정</Button>}
        >
          <p>요청자에게 쪽지로 알려요.</p>
        </Dialog>
      </>
    );
  }

  it('opens from a button and returns focus to it on close', () => {
    const onClose = vi.fn();
    const { container } = render(<Harness onClose={onClose} />);
    const opener = screen.getByRole('button', { name: '반려' });
    const dialog = container.querySelector('dialog');
    if (!dialog) throw new Error('dialog not rendered');

    opener.focus();
    fireEvent.click(opener);
    expect(dialog.open).toBe(true);
    expect(dialog.getAttribute('aria-labelledby')).toBe(screen.getByRole('heading', { name: '요청을 반려할까요?' }).id);

    const close = within(dialog).getByRole('button', { name: '닫기' });

    close.focus();
    fireEvent.click(close);

    expect(dialog.open).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(opener);
  });

  it('closes once on Esc (cancel) and returns focus', () => {
    const onClose = vi.fn();
    const { container } = render(<Harness onClose={onClose} />);
    const opener = screen.getByRole('button', { name: '반려' });
    const dialog = container.querySelector('dialog');
    if (!dialog) throw new Error('dialog not rendered');

    opener.focus();
    fireEvent.click(opener);
    within(dialog).getByRole('button', { name: '닫기' }).focus();

    const cancel = new Event('cancel', { cancelable: true });

    dialog.dispatchEvent(cancel);

    expect(cancel.defaultPrevented).toBe(true);
    expect(dialog.open).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(opener);
  });

  it('returns focus to the opener without onClose when unmounted while open', () => {
    const onClose = vi.fn();

    function Host() {
      const [open, setOpen] = useState(false);
      const [shown, setShown] = useState(true);

      return (
        <>
          <Button onClick={() => setOpen(true)}>열기</Button>
          {shown && (
            <Dialog
              open={open}
              title="삭제할까요?"
              onClose={() => {
                setOpen(false);
                onClose();
              }}
            >
              <Button onClick={() => setShown(false)}>다른 화면으로</Button>
            </Dialog>
          )}
        </>
      );
    }

    const { container } = render(<Host />);
    const opener = screen.getByRole('button', { name: '열기' });

    opener.focus();
    fireEvent.click(opener);

    const inside = screen.getByRole('button', { name: '다른 화면으로' });

    inside.focus();
    fireEvent.click(inside);

    expect(container.querySelector('dialog')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(opener);
  });
});

describe('StatusMessage', () => {
  it('announces results politely and errors at once', () => {
    render(
      <>
        <StatusMessage tone="good">설정을 저장했어요.</StatusMessage>
        <StatusMessage tone="bad">저장하지 못했어요.</StatusMessage>
      </>
    );

    const status = screen.getByRole('status');
    const alert = screen.getByRole('alert');

    expect(status.className).toBe('sa-status is-good');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(alert.getAttribute('aria-live')).toBe('assertive');
    expect(alert.textContent).toBe('저장하지 못했어요.');
  });

  it('keeps the empty live region in place for the first message', () => {
    const { rerender } = render(<StatusMessage tone="good" />);
    const region = screen.getByRole('status');

    expect(region.textContent).toBe('');

    rerender(<StatusMessage tone="good">설정을 저장했어요.</StatusMessage>);

    expect(screen.getByRole('status')).toBe(region);
    expect(region.textContent).toBe('설정을 저장했어요.');
  });
});

describe('MockBadge', () => {
  it('uses the fixed mock wording', () => {
    render(<MockBadge />);

    expect(MOCK_BADGE_TEXT).toBe('목업 · 아직 동작하지 않아요');
    expect(screen.getByText(MOCK_BADGE_TEXT).className).toBe('sa-mock');
  });
});

describe('UnimplementedCard', () => {
  it('says what the screen is for and where the plan lives', () => {
    render(
      <UnimplementedCard
        title="지면 편성"
        purpose="영상과 게시판마다 광고 위치를 정하는 화면이에요."
        specPath=".agents/plans/ads-admin-v2-spec.md"
      />
    );

    const card = screen.getByRole('region', { name: '지면 편성' });

    expect(card.className).toBe('sa-card is-unbuilt');
    expect(within(card).getByText('.agents/plans/ads-admin-v2-spec.md').tagName).toBe('CODE');
  });

  it('uses an h3 under a section heading', () => {
    render(<UnimplementedCard title="리포트 v2" purpose="차원별 표" specPath="spec.md §8.6" headingLevel={3} />);

    expect(screen.getByRole('heading', { name: '리포트 v2', level: 3 })).toBeTruthy();
  });
});

describe('Note', () => {
  it('renders a toned note with a bold lead', () => {
    render(
      <Note tone="warn" title="버전 주의">
        쪽지가 실패할 수 있어요.
      </Note>
    );

    const note = screen.getByRole('note');

    expect(note.className).toBe('sa-note is-warn');
    expect(note.textContent).toBe('버전 주의 · 쪽지가 실패할 수 있어요.');
  });

  it('puts the actions after the text', () => {
    render(
      <Note tone="warn" title="모양이 조금 달라질 수 있어요" actions={<Button>확인했어요</Button>}>
        옮겼어요.
      </Note>
    );

    const note = screen.getByRole('note');

    expect(note.classList.contains('has-actions')).toBe(true);
    expect(within(note).getByRole('button', { name: '확인했어요' })).toBeTruthy();
  });
});

describe('KeyValue', () => {
  it('pairs row headers with values', () => {
    render(
      <KeyValue
        label="요청서"
        rows={[
          { key: 'name', label: '광고 이름', value: '블프 미드롤 20초' },
          { key: 'views', label: '희망 노출 수', value: '80,000', numeric: true },
        ]}
      />
    );

    const table = screen.getByRole('table', { name: '요청서' });

    expect(within(table).getByRole('rowheader', { name: '희망 노출 수' })).toBeTruthy();
    expect(within(table).getByRole('cell', { name: '80,000' }).className).toBe('sa-num');
  });
});

describe('ActivityLog', () => {
  it('lists entries with machine-readable times', () => {
    render(
      <ActivityLog
        label="처리 기록"
        entries={[{ id: '1', time: '10.18 10:31', datetime: '2026-10-18T10:31', text: 'admin이 검토를 시작했어요.' }]}
      />
    );

    const list = screen.getByRole('list', { name: '처리 기록' });

    expect(within(list).getByText('10.18 10:31').getAttribute('datetime')).toBe('2026-10-18T10:31');
  });
});

describe('ColorField', () => {
  function Controlled({
    initial = null,
    onValue,
    alpha = false,
  }: {
    initial?: string | null;
    onValue?: (next: string | null) => void;
    alpha?: boolean;
  }) {
    const [value, setValue] = useState<string | null>(initial);

    return (
      <>
        <ColorField
          label="강조색"
          value={value}
          onChange={(next) => {
            onValue?.(next);
            setValue(next);
          }}
          emptyLabel="스킨 기본값 사용"
          alpha={alpha}
        />
        <output data-testid="value">{value ?? 'null'}</output>
      </>
    );
  }

  const text = () => screen.getByRole<HTMLInputElement>('textbox', { name: '강조색' });
  const picker = () => screen.getByLabelText<HTMLInputElement>('강조색 색 고르기');

  it('names the picker and the text input from one label', () => {
    render(<Controlled initial="#cdf352" />);

    expect(text().value).toBe('#cdf352');
    expect(picker().type).toBe('color');
    expect(picker().value).toBe('#cdf352');
    expect(screen.getByRole('button', { name: '강조색 지우기' })).toBeTruthy();
  });

  it('keeps the picker and the text in step, lowercased', () => {
    const onValue = vi.fn();

    render(<Controlled initial="#cdf352" onValue={onValue} />);

    fireEvent.change(picker(), { target: { value: '#112233' } });
    expect(text().value).toBe('#112233');

    fireEvent.change(text(), { target: { value: '#AABBCC' } });
    expect(onValue).toHaveBeenLastCalledWith('#aabbcc');
    expect(picker().value).toBe('#aabbcc');
    expect(text().value).toBe('#aabbcc');
    expect(screen.getByTestId('value').textContent).toBe('#aabbcc');
  });

  it('holds back invalid text and links the format error', () => {
    const onValue = vi.fn();

    render(<Controlled initial="#cdf352" onValue={onValue} />);

    fireEvent.change(text(), { target: { value: '#12' } });
    expect(text().getAttribute('aria-invalid')).toBeNull();

    fireEvent.blur(text());

    const error = screen.getByText(COLOR_FORMAT_ERROR);

    expect(onValue).not.toHaveBeenCalled();
    expect(screen.getByTestId('value').textContent).toBe('#cdf352');
    expect(text().getAttribute('aria-invalid')).toBe('true');
    expect(text().getAttribute('aria-describedby')?.split(' ')).toContain(error.id);

    fireEvent.change(text(), { target: { value: '#123456' } });
    expect(screen.queryByText(COLOR_FORMAT_ERROR)).toBeNull();
    expect(onValue).toHaveBeenLastCalledWith('#123456');
  });

  it('refuses #rrggbbaa without alpha', () => {
    const onValue = vi.fn();

    render(<Controlled initial="#cdf352" onValue={onValue} />);
    fireEvent.change(text(), { target: { value: '#00000026' } });
    fireEvent.blur(text());

    expect(onValue).not.toHaveBeenCalled();
    expect(screen.getByText(COLOR_FORMAT_ERROR)).toBeTruthy();
  });

  it('takes #rrggbbaa with alpha, lowercased, while the picker stays opaque', () => {
    const onValue = vi.fn();

    render(<Controlled initial="#cdf352" onValue={onValue} alpha />);
    fireEvent.change(text(), { target: { value: '#AABBCC26' } });

    expect(onValue).toHaveBeenLastCalledWith('#aabbcc26');
    expect(text().value).toBe('#aabbcc26');
    // `input type=color` has no alpha, so it shows the color without it and picks an opaque one.
    expect(picker().value).toBe('#aabbcc');

    fireEvent.change(picker(), { target: { value: '#112233' } });

    expect(onValue).toHaveBeenLastCalledWith('#112233');

    fireEvent.change(text(), { target: { value: '#1122334' } });
    fireEvent.blur(text());

    expect(screen.getByText(ALPHA_COLOR_FORMAT_ERROR)).toBeTruthy();
    expect(screen.getByTestId('value').textContent).toBe('#112233');
  });

  it('shows the format error on Enter as well', () => {
    render(<Controlled initial={null} />);

    fireEvent.change(text(), { target: { value: 'red' } });
    fireEvent.keyDown(text(), { key: 'Enter' });

    expect(screen.getByText(COLOR_FORMAT_ERROR)).toBeTruthy();
    expect(screen.getByTestId('value').textContent).toBe('null');
  });

  it('shows the default state for null and clears back to it', () => {
    const onValue = vi.fn();

    render(<Controlled initial="#cdf352" onValue={onValue} />);

    fireEvent.click(screen.getByRole('button', { name: '강조색 지우기' }));

    const state = screen.getByText('스킨 기본값 사용');

    expect(onValue).toHaveBeenLastCalledWith(null);
    expect(text().value).toBe('');
    expect(document.activeElement).toBe(text());
    expect(screen.queryByRole('button', { name: '강조색 지우기' })).toBeNull();
    expect(text().getAttribute('aria-describedby')?.split(' ')).toContain(state.id);
    expect(picker().getAttribute('aria-describedby')).toBe(state.id);

    fireEvent.change(text(), { target: { value: '#000000' } });
    fireEvent.change(text(), { target: { value: '' } });
    expect(onValue).toHaveBeenLastCalledWith(null);
  });

  it('links outside help, warning and error to both inputs, but the format error to the text only', () => {
    const { rerender } = render(
      <ColorField label="강조색" value="#ffffff" onChange={() => {}} help="진행 막대 색" warning="대비가 낮아요." />
    );

    const help = screen.getByText('진행 막대 색');
    const warning = screen.getByText('대비가 낮아요.');

    for (const input of [text(), picker()]) {
      expect(input.getAttribute('aria-describedby')?.split(' ')).toEqual(expect.arrayContaining([help.id, warning.id]));
      expect(input.getAttribute('aria-invalid')).toBeNull();
    }

    rerender(<ColorField label="강조색" value="#ffffff" onChange={() => {}} error="서버가 거부했어요." />);

    const error = screen.getByText('서버가 거부했어요.');

    for (const input of [text(), picker()]) {
      expect(input.getAttribute('aria-describedby')?.split(' ')).toContain(error.id);
      expect(input.getAttribute('aria-invalid')).toBe('true');
    }

    fireEvent.change(text(), { target: { value: '#12' } });
    fireEvent.blur(text());

    const format = screen.getByText(COLOR_FORMAT_ERROR);

    expect(text().getAttribute('aria-describedby')?.split(' ')).toContain(format.id);
    expect(picker().getAttribute('aria-describedby')?.split(' ')).not.toContain(format.id);
  });

  it('reports the format error and blocks Enter from submitting while it shows', () => {
    const onInvalidChange = vi.fn();
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());

    render(
      <form onSubmit={onSubmit}>
        <ColorField label="강조색" value="#cdf352" onChange={() => {}} onInvalidChange={onInvalidChange} />
      </form>
    );

    fireEvent.change(text(), { target: { value: '#12' } });
    expect(fireEvent.keyDown(text(), { key: 'Enter' })).toBe(false);
    expect(onInvalidChange).toHaveBeenLastCalledWith(true);

    fireEvent.change(text(), { target: { value: '#123456' } });
    expect(onInvalidChange).toHaveBeenLastCalledWith(false);
    expect(onInvalidChange).toHaveBeenCalledTimes(2);
    expect(fireEvent.keyDown(text(), { key: 'Enter' })).toBe(true);
  });
});

describe('CodeBlock', () => {
  const CODE = '<media-ads src="/ads/">\n\t<video></video>\n</media-ads>';

  function stubClipboard(writeText: ((text: string) => Promise<void>) | undefined) {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: writeText ? { writeText } : undefined,
    });
  }

  afterEach(() => {
    // SAFETY: jsdom has no clipboard; drop the stub so tests do not leak into each other.
    delete (navigator as { clipboard?: unknown }).clipboard;
    window.getSelection()?.removeAllRanges();
  });

  it('shows the code in a named, focusable region', () => {
    render(<CodeBlock code={CODE} label="설치 코드" />);

    const region = screen.getByRole('region', { name: '설치 코드' });

    expect(region.tagName).toBe('PRE');
    expect(region.tabIndex).toBe(0);
    expect(region.textContent).toBe(CODE);
    expect(screen.getByRole('button', { name: '설치 코드 복사' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('copies with the clipboard and says so politely', async () => {
    const writeText = vi.fn(() => Promise.resolve());

    stubClipboard(writeText);
    render(<CodeBlock code={CODE} label="설치 코드" />);

    fireEvent.click(screen.getByRole('button', { name: '설치 코드 복사' }));

    expect(await screen.findByText(COPY_DONE_TEXT)).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith(CODE);
    expect(screen.getByRole('status').textContent).toBe(COPY_DONE_TEXT);
  });

  it.each([
    ['rejects', (_text: string) => Promise.reject(new Error('denied'))],
    ['is missing', undefined],
  ])('selects the code and asks for a manual copy when the clipboard %s', async (_case, writeText) => {
    stubClipboard(writeText);
    render(<CodeBlock code={CODE} label="설치 코드" />);

    fireEvent.click(screen.getByRole('button', { name: '설치 코드 복사' }));

    const message = (await screen.findByText(COPY_FAILED_TEXT)).closest('p');
    const region = screen.getByRole('region', { name: '설치 코드' });

    expect(message?.getAttribute('role')).toBe('status');
    expect(message?.classList.contains('is-warn')).toBe(true);
    expect(region.getAttribute('aria-describedby')).toBe(message?.id);
    expect(document.activeElement).toBe(region);
    expect(window.getSelection()?.toString()).toBe(CODE);
  });

  it('announces a repeated result again with a new text node', async () => {
    stubClipboard(() => Promise.resolve());
    render(<CodeBlock code={CODE} label="설치 코드" />);

    const button = screen.getByRole('button', { name: '설치 코드 복사' });

    fireEvent.click(button);

    const first = await screen.findByText(COPY_DONE_TEXT);

    fireEvent.click(button);
    await waitFor(() => expect(screen.getByText(COPY_DONE_TEXT)).not.toBe(first));

    expect(screen.getByRole('status').textContent).toBe(COPY_DONE_TEXT);
    expect(screen.getByRole('region', { name: '설치 코드' }).getAttribute('aria-describedby')).toBeNull();
  });

  it('drops the copy result when the code changes', async () => {
    stubClipboard(() => Promise.resolve());

    const { rerender } = render(<CodeBlock code={CODE} label="설치 코드" />);

    fireEvent.click(screen.getByRole('button', { name: '설치 코드 복사' }));
    await screen.findByText(COPY_DONE_TEXT);

    rerender(<CodeBlock code="<video></video>" label="설치 코드" />);
    expect(screen.queryByText(COPY_DONE_TEXT)).toBeNull();
  });

  it('can keep the label for screen readers only', () => {
    render(<CodeBlock code={CODE} label="예제 쿼리" hideLabel />);

    expect(screen.getByText('예제 쿼리').className).toBe('sa-sr');
    expect(screen.getByRole('region', { name: '예제 쿼리' })).toBeTruthy();
  });
});

describe('SubNav', () => {
  const items: SubNavItem[] = [
    { id: 'list', label: '프리셋', href: '#/players' },
    { id: 'setup', label: '초기 설정 방법', href: '#/players/setup', current: true },
    { id: 'options', label: '옵션 설명', href: '#/players/options' },
  ];

  it('is a named group of plain links with the current page marked', () => {
    render(<SubNav label="플레이어 화면" items={items} />);

    const nav = screen.getByRole('navigation', { name: '플레이어 화면' });
    const links = within(nav).getAllByRole('link');

    expect(links.map((link) => link.textContent)).toEqual(['프리셋', '초기 설정 방법', '옵션 설명']);
    expect(links.map((link) => link.getAttribute('aria-current'))).toEqual([null, 'page', null]);
    expect(links.every((link) => link.tabIndex === 0 && link.hasAttribute('href'))).toBe(true);
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByRole('tab')).toBeNull();
  });

  it('hands plain clicks to onNavigate and leaves modified clicks to the browser', () => {
    const onNavigate = vi.fn((_item: SubNavItem, event: { preventDefault: () => void }) => event.preventDefault());

    render(<SubNav label="플레이어 화면" items={items} onNavigate={onNavigate} />);

    fireEvent.click(screen.getByRole('link', { name: '옵션 설명' }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate.mock.calls[0]?.[0].id).toBe('options');

    fireEvent.click(screen.getByRole('link', { name: '프리셋' }), { metaKey: true });
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});

describe('SectionNav', () => {
  const items: SectionNavItem[] = [
    { id: 's-basic', label: '기본' },
    { id: 's-theme', label: '테마', off: true },
    { id: 's-ads', label: '광고 화면', errors: 2 },
  ];

  it.each(['column', 'row'] as const)('is a named list of section links in the %s shape', (variant) => {
    const onNavigate = vi.fn();

    render(<SectionNav items={items} current="s-ads" variant={variant} onNavigate={onNavigate} />);

    const links = within(screen.getByRole('navigation', { name: '편집 구획' })).getAllByRole('link');

    expect(links.map((link) => link.getAttribute('href'))).toEqual(['#s-basic', '#s-theme', '#s-ads']);
    expect(links.map((link) => link.getAttribute('aria-current'))).toEqual([null, null, 'true']);
    // The error count and the unusable section are words, not color alone.
    expect(links[1]?.textContent).toBe('테마 쓸 수 없음');
    expect(links[2]?.textContent).toBe('광고 화면오류 2');

    fireEvent.click(links[0]!);
    expect(onNavigate).toHaveBeenCalledWith('s-basic');

    fireEvent.click(links[1]!, { ctrlKey: true });
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('is a labelled select at phone width that names the sections with errors', () => {
    const onNavigate = vi.fn();

    render(<SectionNav items={items} current="s-basic" variant="select" onNavigate={onNavigate} />);

    const select = screen.getByRole('combobox', { name: '구획으로 이동' });

    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent)
    ).toEqual(['기본', '테마 · 쓸 수 없음', '광고 화면 · 오류 2']);
    expect(document.getElementById(select.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
      '광고 화면 구획에 고칠 칸이 2개 있어요.'
    );

    fireEvent.change(select, { target: { value: 's-ads' } });
    expect(onNavigate).toHaveBeenCalledWith('s-ads');
  });
});

describe('Segmented', () => {
  const options = [
    { value: 'none', label: '안 함' },
    { value: '', label: '정보만 (기본)' },
    { value: 'auto', label: '미리' },
  ] as const;

  it('is one native radio group named by its label and described by its help and error', () => {
    const onChange = vi.fn();

    render(
      <Segmented
        label="미리 불러오기"
        value=""
        options={options}
        onChange={onChange}
        help="정보만 먼저 받아요."
        error="다시 골라 주세요."
        id="preload"
      />
    );

    const group = screen.getByRole('radiogroup', { name: '미리 불러오기' });
    const described = (group.getAttribute('aria-describedby') ?? '')
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent);

    expect(described).toEqual(['다시 골라 주세요.', '정보만 먼저 받아요.']);
    expect(group.getAttribute('aria-invalid')).toBe('true');
    expect(
      within(group)
        .getAllByRole('radio')
        .map((radio) => radio.getAttribute('name'))
    ).toEqual(Array(3).fill(within(group).getAllByRole('radio')[0]?.getAttribute('name')));
    // Tab lands on the checked radio, which carries the id a screen focuses.
    expect(screen.getByRole('radio', { name: '정보만 (기본)' }).id).toBe('preload');

    fireEvent.click(screen.getByRole('radio', { name: '미리' }));
    expect(onChange).toHaveBeenCalledWith('auto');
  });

  it('disables every choice', () => {
    render(<Segmented label="미리 불러오기" value="" options={options} onChange={() => {}} disabled />);

    expect(screen.getAllByRole('radio').every((radio) => radio.matches(':disabled'))).toBe(true);
  });
});

describe('SwitchList', () => {
  it('names each switch by its name and describes it, with a lock reason replacing the description', () => {
    const onCheckedChange = vi.fn();

    render(
      <SwitchList
        items={[
          { id: 'sw-a', name: '자동 재생', description: '바로 재생해요.', checked: false, onCheckedChange },
          {
            id: 'sw-m',
            name: '음소거로 시작',
            description: '소리 없이 시작해요.',
            checked: true,
            onCheckedChange,
            badge: '자동 재생 때문에 켜짐',
            locked: '자동 재생을 끄면 바꿀 수 있어요.',
            error: '고쳐 주세요.',
          },
        ]}
      />
    );

    const autoplay = screen.getByRole('switch', { name: '자동 재생' });
    const muted = screen.getByRole('switch', { name: '음소거로 시작' });
    const text = (element: HTMLElement) =>
      (element.getAttribute('aria-describedby') ?? '').split(' ').map((id) => document.getElementById(id)?.textContent);

    expect(autoplay.getAttribute('aria-checked')).toBe('false');
    expect(text(autoplay)).toEqual(['바로 재생해요.']);
    expect(muted.getAttribute('aria-checked')).toBe('true');
    expect(muted.matches(':disabled')).toBe(true);
    expect(text(muted)).toEqual(['자동 재생을 끄면 바꿀 수 있어요.', '고쳐 주세요.']);
    expect(muted.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('자동 재생 때문에 켜짐')).toBeTruthy();

    fireEvent.click(autoplay);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });
});

describe('DisabledReason', () => {
  function Form({ active }: { active: boolean }) {
    return (
      <DisabledReason active={active} reason={<b>기본 video에서는 테마를 쓸 수 없어요.</b>}>
        <Field label="강조색">
          <Input defaultValue="#112233" />
        </Field>
      </DisabledReason>
    );
  }

  it('disables the controls inside, keeps their values and describes them with the reason', () => {
    const { rerender } = render(<Form active />);

    const field = screen.getByLabelText('강조색');

    expect(field.matches(':disabled')).toBe(true);
    expect(field).toHaveProperty('value', '#112233');
    expect(
      (field.getAttribute('aria-describedby') ?? '').split(' ').map((id) => document.getElementById(id)?.textContent)
    ).toContain('기본 video에서는 테마를 쓸 수 없어요.');

    rerender(<Form active={false} />);

    expect(screen.getByLabelText('강조색')).toBe(field);
    expect(field.matches(':disabled')).toBe(false);
    expect(screen.queryByText('기본 video에서는 테마를 쓸 수 없어요.')).toBeNull();
  });
});

describe('Disclosure', () => {
  it('folds content in a native details named by its summary', () => {
    const { container, rerender } = render(<Disclosure summary="예전 정적 코드 보기">코드</Disclosure>);

    const details = container.querySelector('details');

    expect(details?.open).toBe(false);
    expect(details?.querySelector('summary')?.textContent).toBe('예전 정적 코드 보기');

    rerender(
      <Disclosure summary="예전 정적 코드 보기" open>
        코드
      </Disclosure>
    );
    expect(container.querySelector('details')?.open).toBe(true);
  });
});

describe('PresetMark', () => {
  it('names each mark in words and never takes a status color', () => {
    const { container } = render(
      <>
        <PresetMark kind="site" />
        <PresetMark kind="moved" />
        <PresetMark kind="builtIn" />
      </>
    );

    expect([...container.querySelectorAll('.sa-badge')].map((badge) => badge.textContent)).toEqual([
      '사이트 적용',
      '중립 스킨에서 옮김',
      '내장',
    ]);
    expect(container.querySelector('[data-st]')).toBeNull();
  });
});
