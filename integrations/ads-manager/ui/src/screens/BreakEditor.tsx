import { useId, useState } from 'react';

import {
  type AdBreak,
  type AdItem,
  type BreakPosition,
  type Creative,
  makeItem,
  MAX_ADS_PER_BREAK,
  MAX_BREAKS,
  newId,
} from '../api/model';
import { useConfirm } from '../app/confirm';
import { NumberInput, PlusIcon } from '../app/ui';
import type { Workspace } from '../app/workspace-context';
import { Button, Card, Check, Field, Input, Select } from '../components';
import { HelpLink } from '../help';

const CREATIVE_STATE_TEXT = {
  idle: '소재 목록을 불러오고 있어요.',
  loading: '소재 목록을 불러오고 있어요.',
  error: '소재 목록을 불러오지 못했어요.',
  ready: '소재 메뉴에서 등록한 소재를 추가할 수 있어요.',
} satisfies Record<Workspace['creativesState'], string>;

const NO_CREATIVE_OPTION = {
  idle: '소재 목록을 불러오고 있어요',
  loading: '소재 목록을 불러오고 있어요',
  error: '소재 목록을 불러오지 못했어요',
  ready: '먼저 사용할 소재를 등록해 주세요',
} satisfies Record<Workspace['creativesState'], string>;

const NO_CREATIVE_REASON = {
  idle: '소재 목록을 불러오고 있어요.',
  loading: '소재 목록을 불러오고 있어요.',
  error: '소재 목록을 불러오지 못했어요. 소재 목록 새로고침을 눌러 주세요.',
  ready: '사용할 소재가 없어요.',
} satisfies Record<Workspace['creativesState'], string>;

const POSITION_ERROR = '0.01 이상의 초를 숫자로 입력해 주세요. 예: 30';

const SAVE_BLOCKED = '저장하지 못했어요. 표시한 항목을 확인해 주세요.';

export const BREAK_NAMES = {
  pre: '프리롤 · 시작 전',
  mid: '미드롤 · 재생 중',
  post: '포스트롤 · 종료 후',
} satisfies Record<BreakPosition, string>;

export interface BreakEditorProps {
  breaks: AdBreak[];
  creatives: Creative[];
  creativesState: Workspace['creativesState'];
  /** Reads the creative list again, e.g. after a creative was added in another tab. */
  reloadCreatives: () => void;
  /** Applies a change to a copy of the draft breaks and marks the draft dirty. */
  change: (mutate: (breaks: AdBreak[]) => void) => void;
  /** Re-sorts breaks chronologically; mid positions settle when their input loses focus. */
  sort: () => void;
  /** Focuses an element after the next render. */
  focus: (request: FocusRequest) => void;
  message: (text: string, error?: boolean) => void;
}

/**
 * A static `selector`, optionally inside the break or item with a server ID. The ID is compared with the element's
 * `data-break-id` / `data-item-id` value and never parsed as a selector, so IDs such as `a.b: c` are safe. `element`
 * instead names a control directly, such as the one focus moved to.
 */
export type FocusRequest = { selector: string; breakId?: string; itemId?: string } | { element: HTMLElement };

export function BreakEditor({
  breaks,
  creatives,
  creativesState,
  reloadCreatives,
  change,
  sort,
  focus,
  message,
}: BreakEditorProps) {
  const add = (position: BreakPosition) => {
    if (breaks.length >= MAX_BREAKS) return message('광고 구간은 최대 100개예요.', true);

    if (position !== 'mid' && breaks.some((br) => br.position === position))
      return message('이미 있는 구간 안에 광고를 추가해 주세요.', true);

    const br: AdBreak = { breakId: newId('break'), position, ads: [] };

    if (position === 'mid') br.atSeconds = 10;

    change((list) => list.push(br));
    sort();
    focus({ breakId: br.breakId, selector: 'button' });
  };

  return (
    <Card
      title={`광고 구간 ${breaks.length}개`}
      actions={
        <div className="sa-row">
          <HelpLink termId="ad-break" />
          <div className="sa-row" role="group" aria-label="광고 구간 추가" data-add-breaks="">
            <Button size="sm" icon={<PlusIcon />} onClick={() => add('pre')}>
              프리롤
            </Button>
            <Button size="sm" icon={<PlusIcon />} onClick={() => add('mid')}>
              미드롤
            </Button>
            <Button size="sm" icon={<PlusIcon />} onClick={() => add('post')}>
              포스트롤
            </Button>
          </div>
        </div>
      }
    >
      <div className="aa-stack">
        <div className="sa-row">
          <span className="sa-small">{CREATIVE_STATE_TEXT[creativesState]}</span>
          <Button size="sm" onClick={reloadCreatives}>
            소재 목록 새로고침
          </Button>
        </div>
        {breaks.length ? null : (
          <p className="sa-small">
            직접 편성이 비어 있어요. 그대로 게시하면 상위 설정 대신 광고 없는 편성이 적용돼요. 광고 구간을 추가하거나
            광고 비활성화를 선택해 주세요.
          </p>
        )}
        {breaks.map((br) => (
          <BreakCard
            key={br.breakId}
            br={br}
            creatives={creatives}
            creativesState={creativesState}
            change={change}
            sort={sort}
            focus={focus}
            message={message}
          />
        ))}
      </div>
    </Card>
  );
}

function BreakCard({
  br,
  creatives,
  creativesState,
  change,
  sort,
  focus,
  message,
}: Omit<BreakEditorProps, 'breaks' | 'reloadCreatives'> & { br: AdBreak }) {
  const confirm = useConfirm();
  const titleId = useId();
  const rotationHelpId = useId();
  const random = br.rotation === 'random';
  const [choice, setChoice] = useState('');
  // The position error shows once the field was left or a save was tried, and clears as soon as the value is valid.
  const [positionChecked, setPositionChecked] = useState(false);
  const available = creatives.filter((creative) => !creative.archived);
  const positionError =
    positionChecked && !(Number.isFinite(br.atSeconds) && (br.atSeconds ?? 0) >= 0.01) ? POSITION_ERROR : undefined;
  const edit = (mutate: (target: AdBreak) => void) =>
    change((list) => {
      const target = list.find((candidate) => candidate.breakId === br.breakId);

      if (target) mutate(target);
    });

  const remove = async () => {
    if (
      br.ads.length &&
      !(await confirm({
        title: '광고 구간을 제거할까요?',
        body: `${BREAK_NAMES[br.position]} 구간과 안의 광고 ${br.ads.length}개를 편집 중인 편성에서 빼요. 초안을 저장하기 전에는 게시본이 바뀌지 않아요.`,
        confirmLabel: '제거',
        danger: true,
      }))
    ) {
      return;
    }

    change((list) =>
      list.splice(
        list.findIndex((candidate) => candidate.breakId === br.breakId),
        1
      )
    );
    focus({ selector: '[data-add-breaks] button' });
  };

  const addItem = () => {
    const creative = available.find((candidate) => candidate.creativeId === choice);
    if (!creative) return message('추가할 소재 버전을 선택해 주세요.', true);

    const item = makeItem(creative, newId('item'));

    edit((target) => target.ads.push(item));
    focus({ itemId: item.itemId, selector: 'input' });
  };

  return (
    <article data-break-id={br.breakId} className="sa-card aa-break" aria-labelledby={titleId}>
      <div className="aa-between">
        <div className="sa-row">
          <h3 id={titleId} className="sa-card-title">
            {BREAK_NAMES[br.position]}
          </h3>
          {br.position === 'mid' ? null : <HelpLink termId={br.position === 'pre' ? 'pre-roll' : 'post-roll'} />}
        </div>
        <Button size="sm" variant="danger" onClick={() => void remove()}>
          구간 삭제
        </Button>
      </div>
      {br.position === 'mid' ? (
        <Field label="본편 재생 위치 (초)" labelAside={<HelpLink termId="mid-roll" />} error={positionError}>
          <NumberInput
            data-at=""
            required
            min={0.01}
            step="any"
            value={br.atSeconds}
            onValue={(value) => edit((target) => (target.atSeconds = value))}
            onInvalid={(event) => {
              const input = event.currentTarget;

              // The field shows the app's own error instead of the browser bubble; the form is still not submitted.
              event.preventDefault();
              setPositionChecked(true);

              if (firstInvalid(input.form) !== input) return;

              focus({ element: input });
              message(SAVE_BLOCKED, true);
            }}
            onBlur={(event) => {
              const next = event.relatedTarget;

              setPositionChecked(true);
              sort();

              // Re-sorting can move the card that holds the control focus went to; keep focus there.
              if (next instanceof HTMLElement) focus({ element: next });
            }}
          />
        </Field>
      ) : null}
      {br.ads.length ? null : <p className="sa-small">구간에 광고를 추가해 주세요. 빈 구간은 저장할 수 없어요.</p>}
      {br.ads.length >= 2 ? (
        <div>
          <Check
            label="광고 중 하나만 골라 보여 주기 (무작위)"
            checked={random}
            aria-describedby={rotationHelpId}
            onChange={(event) => {
              const on = event.currentTarget.checked;

              edit((target) => {
                if (on) target.rotation = 'random';
                else delete target.rotation;
              });
            }}
          />
          <p className="sa-small" id={rotationHelpId}>
            {random
              ? `재생할 때마다 아래 광고 ${br.ads.length}개 중 하나를 같은 확률로 골라 그것만 보여 줘요. 목록 순서는 재생 순서가 아니에요.`
              : `아래 광고 ${br.ads.length}개를 목록 순서대로 모두 재생해요.`}
          </p>
        </div>
      ) : null}
      {br.ads.map((ad, index) => (
        <ItemFields
          key={ad.itemId}
          ad={ad}
          index={index}
          count={br.ads.length}
          random={random}
          creative={creatives.find((candidate) => candidate.creativeId === ad.creativeId)}
          edit={(mutate) =>
            edit((target) => {
              mutate(target.ads);

              // One ad left cannot rotate; the server refuses `random` below two ads.
              if (target.ads.length < 2) delete target.rotation;
            })
          }
          focus={focus}
          message={message}
          breakId={br.breakId}
        />
      ))}
      <div className="sa-row" style={{ alignItems: 'flex-end' }}>
        <Field label="추가할 소재" labelAside={<HelpLink termId="ad-item" />}>
          <Select value={choice} onChange={(event) => setChoice(event.currentTarget.value)}>
            <option value="">
              {available.length ? '소재 버전을 선택해 주세요' : NO_CREATIVE_OPTION[creativesState]}
            </option>
            {available.map((creative) => (
              <option key={creative.creativeId} value={creative.creativeId}>
                {creative.name} · v{creative.version} · {creative.kind === 'image' ? '이미지' : '영상'}
              </option>
            ))}
          </Select>
        </Field>
        <Button
          disabledReason={
            !available.length
              ? NO_CREATIVE_REASON[creativesState]
              : br.ads.length >= MAX_ADS_PER_BREAK
                ? `한 구간에는 광고를 ${MAX_ADS_PER_BREAK}개까지 넣을 수 있어요.`
                : undefined
          }
          onClick={addItem}
        >
          광고 추가
        </Button>
      </div>
    </article>
  );
}

/** The form's first control that fails its constraints, read from `validity` so no `invalid` event fires. */
function firstInvalid(form: HTMLFormElement | null): Element | undefined {
  return Array.from(form?.elements ?? []).find(
    (element) =>
      (element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement) &&
      element.willValidate &&
      !element.validity.valid
  );
}

function ItemFields({
  ad,
  index,
  count,
  random,
  creative,
  edit,
  focus,
  message,
  breakId,
}: {
  ad: AdItem;
  index: number;
  count: number;
  /** The break plays one of its ads at random, so the list order is not a play order. */
  random: boolean;
  creative: Creative | undefined;
  edit: (mutate: (ads: AdItem[]) => void) => void;
  focus: (request: FocusRequest) => void;
  message: (text: string, error?: boolean) => void;
  breakId: string;
}) {
  const [skipDraft, setSkipDraft] = useState(ad.skipAfterSeconds ?? 1);
  const editItem = (mutate: (item: AdItem) => void) =>
    edit((ads) => {
      const item = ads.find((candidate) => candidate.itemId === ad.itemId);

      if (item) mutate(item);
    });

  const move = (delta: -1 | 1) => {
    edit((ads) => {
      const from = ads.findIndex((candidate) => candidate.itemId === ad.itemId);
      const [item] = ads.splice(from, 1);

      if (item) ads.splice(from + delta, 0, item);
    });
    focus({ itemId: ad.itemId, selector: `[data-move="${delta}"]` });
    message(`${index + 1}번 광고를 ${index + delta + 1}번째로 이동했어요. 저장한 뒤 게시해 주세요.`);
  };

  const skipAfter = ad.skipAfterSeconds !== null;

  return (
    <fieldset data-item-id={ad.itemId} className="aa-item">
      <legend className="sa-label">
        {random ? '후보 ' : ''}
        {index + 1}. {creative?.name || ad.creativeId}
      </legend>
      <div className="aa-between">
        <span className="sa-small">
          v{ad.creativeVersion} · {ad.mime}
          {creative?.archived ? ' · 보관된 소재: 게시 전에 제거하거나 교체해 주세요.' : ''}
        </span>
        <div className="sa-row">
          {random ? null : (
            <>
              <Button
                size="sm"
                data-move="-1"
                disabled={index === 0}
                aria-label={`${index + 1}번 광고 위로 이동`}
                onClick={() => move(-1)}
              >
                위로
              </Button>
              <Button
                size="sm"
                data-move="1"
                disabled={index === count - 1}
                aria-label={`${index + 1}번 광고 아래로 이동`}
                onClick={() => move(1)}
              >
                아래로
              </Button>
            </>
          )}
          <Button
            size="sm"
            onClick={() => {
              edit((ads) => ads.splice(index, 1));
              focus({ breakId, selector: 'select' });
            }}
          >
            광고 제거
          </Button>
        </div>
      </div>
      <div className="aa-form-grid">
        <Field label="클릭 목적지 URL" labelAside={<HelpLink termId="click-through-url" />}>
          <Input
            inputMode="url"
            placeholder="선택 사항"
            value={ad.clickUrl ?? ''}
            onChange={(event) => {
              const value = event.currentTarget.value.trim();

              editItem((item) => (item.clickUrl = value || null));
            }}
          />
        </Field>
        <Field label="이 광고의 스킵" labelAside={<HelpLink termId="ad-skip" />}>
          <Select
            value={skipAfter ? 'after' : 'never'}
            onChange={(event) => {
              const after = event.currentTarget.value === 'after';

              editItem((item) => (item.skipAfterSeconds = after ? skipDraft : null));
            }}
          >
            <option value="never">스킵 불가</option>
            <option value="after">N초 후 현재 광고만 스킵</option>
          </Select>
        </Field>
        {skipAfter ? (
          <Field label="스킵 대기 (초)" labelAside={<HelpLink termId="skip-offset" />}>
            <NumberInput
              required
              min={1}
              max={3600}
              step={1}
              value={ad.skipAfterSeconds}
              onValue={(value) => {
                setSkipDraft(value);
                editItem((item) => (item.skipAfterSeconds = value));
              }}
            />
          </Field>
        ) : null}
        {ad.kind === 'image' ? (
          <Field label="이미지 · GIF 표시 (초)" labelAside={<HelpLink termId="image-display-time" />}>
            <NumberInput
              required
              min={0.01}
              max={3600}
              step="any"
              value={ad.displaySeconds}
              onValue={(value) => editItem((item) => (item.displaySeconds = value))}
            />
          </Field>
        ) : null}
      </div>
    </fieldset>
  );
}
