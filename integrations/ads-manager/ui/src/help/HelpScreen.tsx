import { useEffect, useId, useState } from 'react';

import { type AdStatus, Card, Chip, ChipGroup, Note, StatusBadge, Stepper } from '../components';
import { menusFor, workSteps } from './guide';
import { HelpLink, onHelpReopen } from './HelpLink';
import { HelpMotion, useReducedMotion } from './HelpMotion';
import { motionFor } from './motions';
import {
  categoryName,
  HELP_CATEGORIES,
  HELP_STATE_LABELS,
  HELP_TERMS,
  type HelpCategoryId,
  type HelpHost,
  type HelpState,
  type HelpTermId,
  isHelpTermId,
  termFor,
  termsFor,
} from './terms';

const STATE_BADGE = {
  live: 'active',
  mock: 'draft',
  planned: 'archived',
} satisfies Record<HelpState, AdStatus>;

function StateBadge({ state, label }: { state: HelpState; label?: string | undefined }) {
  return <StatusBadge status={STATE_BADGE[state]} label={label ?? HELP_STATE_LABELS[state]} />;
}

export function termHeadingId(termId: HelpTermId): string {
  return `sa-help-${termId}`;
}

type Filter = HelpCategoryId | 'all';

export interface HelpScreenProps {
  host: HelpHost;
  /** Term to open. Unknown ids, and terms the host does not show, are ignored. */
  termId?: string | undefined;
  /** Id for the page title, so the app can focus it after a menu change. */
  titleId?: string | undefined;
}

/** Feature guide and term dictionary (contract §3.1). Renders static content only; it never calls the API. */
export function HelpScreen({ host, termId, titleId }: HelpScreenProps) {
  const fallbackTitleId = useId();
  const dictionaryId = useId();
  const reduced = useReducedMotion();

  const ids = termsFor(host);
  const target = isHelpTermId(termId) && ids.includes(termId) ? termId : undefined;
  const categories = HELP_CATEGORIES.filter((category) => ids.some((id) => HELP_TERMS[id].category === category.id));

  const [filter, setFilter] = useState<Filter>('all');
  const [openedTarget, setOpenedTarget] = useState(target);

  // A newly opened term must be on screen, so drop a filter that hides it.
  if (openedTarget !== target) {
    setOpenedTarget(target);

    if (target && filter !== 'all' && HELP_TERMS[target].category !== filter) setFilter('all');
  }

  const [reopened, setReopened] = useState(0);

  // A link to the open term changes nothing in the address, so it asks to scroll and focus again.
  useEffect(() => {
    if (!target) return;

    return onHelpReopen((termId) => {
      if (termId !== target) return;

      setFilter((current) => (current !== 'all' && HELP_TERMS[termId].category !== current ? 'all' : current));
      setReopened((count) => count + 1);
    });
  }, [target]);

  useEffect(() => {
    if (!target) return;

    const heading = document.getElementById(termHeadingId(target));
    if (!heading) return;

    // jsdom has no scrollIntoView.
    if ('scrollIntoView' in heading) heading.scrollIntoView({ block: 'start' });

    heading.focus({ preventScroll: true });
  }, [target, reopened]);

  const shown = filter === 'all' ? categories : categories.filter((category) => category.id === filter);

  return (
    <div className="sa-help-page">
      <div className="sa-phead">
        <div>
          <h1 id={titleId ?? fallbackTitleId} className="sa-page-title" tabIndex={-1}>
            도움말
          </h1>
          <p className="sa-small">메뉴마다 하는 일과 화면에 나오는 광고 용어를 설명해요.</p>
        </div>
      </div>

      <Card title="기능 안내">
        <div className="sa-help-sec">
          <h3 className="sa-label sa-strong">기본 작업 순서</h3>
          <Stepper
            variant="flow"
            label="기본 작업 순서"
            steps={workSteps(host).map((step) => ({
              id: step.id,
              label: <HelpLink termId={step.termId}>{step.label}</HelpLink>,
            }))}
          />
          <Note title="미리보기와 재생 테스트">
            미리보기는 게시 전에 편집 중인 초안을 재생하고 통계에 남지 않아요. 재생 테스트는 게시한 편성을 재생하고
            통계에 기록돼요.
          </Note>
          <h3 className="sa-label sa-strong">메뉴별 화면</h3>
          <ul className="sa-help-menus">
            {menusFor(host).map((menu) => (
              <li key={menu.route}>
                <div>
                  <a className="sa-strong" href={`#/${menu.route}`}>
                    {menu.name}
                  </a>
                  {menu.states.map(({ state, label }) => (
                    <StateBadge key={label ?? state} state={state} label={label} />
                  ))}
                </div>
                <p className="sa-small">{menu.summary}</p>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <section className="sa-help-sec" aria-labelledby={dictionaryId}>
        <h2 id={dictionaryId} className="sa-card-title">
          용어 사전
        </h2>
        <ChipGroup label="용어 분류">
          <Chip pressed={filter === 'all'} count={ids.length} onClick={() => setFilter('all')}>
            전체
          </Chip>
          {categories.map((category) => (
            <Chip
              key={category.id}
              pressed={filter === category.id}
              count={ids.filter((id) => HELP_TERMS[id].category === category.id).length}
              onClick={() => setFilter(category.id)}
            >
              {categoryName(category, host)}
            </Chip>
          ))}
        </ChipGroup>
        {reduced && <Note>움직임 줄이기 설정에 맞춰 그림을 멈춘 한 장면으로 보여 줘요.</Note>}
        {shown.map((category) => (
          <section key={category.id} className="sa-help-sec" aria-labelledby={`sa-help-cat-${category.id}`}>
            <h3 id={`sa-help-cat-${category.id}`} className="sa-label sa-strong">
              {categoryName(category, host)}
            </h3>
            <ul className="sa-terms">
              {ids
                .filter((id) => HELP_TERMS[id].category === category.id)
                .map((id) => (
                  <TermCard key={id} termId={id} host={host} reduced={reduced} />
                ))}
            </ul>
          </section>
        ))}
      </section>
    </div>
  );
}

function TermCard({ termId, host, reduced }: { termId: HelpTermId; host: HelpHost; reduced: boolean }) {
  const term = termFor(termId, host);
  const motion = motionFor(termId);
  const headingId = termHeadingId(termId);
  const shownIds = termsFor(host);
  const related = (term.related ?? []).filter((id) => shownIds.includes(id));

  return (
    <li>
      <article className="sa-term" aria-labelledby={headingId}>
        <div className="sa-term-h">
          <h4 id={headingId} tabIndex={-1}>
            {term.name}
          </h4>
          <StateBadge state={term.state} />
        </div>
        <p className="sa-body">{term.summary}</p>
        {term.detail !== undefined && <p className="sa-small">{term.detail}</p>}
        <HelpMotion label={term.motionLabel} name={term.name} once={motion.once} reduced={reduced}>
          {motion.render(host)}
        </HelpMotion>
        <p className="sa-small">관련 화면 · {term.screens}</p>
        {related.length > 0 && (
          <p className="sa-small">
            함께 보기 ·{' '}
            {related.map((id, index) => (
              <span key={id}>
                {index > 0 && ', '}
                <HelpLink termId={id}>{termFor(id, host).name}</HelpLink>
              </span>
            ))}
          </p>
        )}
      </article>
    </li>
  );
}
