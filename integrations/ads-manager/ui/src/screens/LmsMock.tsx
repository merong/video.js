import type { CSSProperties } from 'react';

import type { PlayerPreset } from '../player';

// Fixed drawing values (handoff 3.2): the preview saves nothing, so it shows one sample learner.
const PROGRESS = 42;
const LIMIT = 35;
const WATCHED = 34;

// SAFETY: React passes custom properties through `style`; `CSSProperties` only lacks their names.
const vars = (values: Record<string, string>) => values as CSSProperties;

/**
 * The lecture layer beside the editor preview (PlayerMock lecture layer): the watched span and seek limit on the time
 * bar, then the progress line. The live frame shows neither before a learner watches, so this is one fixed picture.
 */
export function LmsMock({ preset }: { preset: PlayerPreset }) {
  const { lms } = preset;
  if (preset.playerType !== 'videojs' || lms.enabled !== true) return null;

  const completion = lms.completion ?? 90;
  const limited = lms.seekLimit === 'watched';
  const accent = preset.theme.accentColor ? vars({ '--sa-pm-accent': preset.theme.accentColor }) : undefined;
  const label = `강의 미리보기: 시청한 구간${limited ? '과 한계 표시' : ''}, 진도 ${PROGRESS}%, 완료 기준 ${completion}%`;

  return (
    <div role="img" aria-label={label}>
      <div className="sa-pm is-360" style={accent}>
        <span className="sa-pm-scene" />
        <div className="sa-pm-ctl">
          <div className="sa-pm-row">
            <span className="sa-pm-track" style={vars({ '--_p': `${WATCHED}%` })}>
              <i className="sa-pm-watched" style={vars({ '--_s': '0%', '--_w': `${WATCHED}%` })} />
              <b />
              {limited ? <i className="sa-pm-limit" style={vars({ '--_l': `${LIMIT}%` })} /> : null}
            </span>
          </div>
        </div>
      </div>
      <p className="sa-pm-lms is-360" style={accent}>
        <b>진도 {PROGRESS}%</b>
        <span>완료 기준 {completion}%</span>
        <span className="sa-pm-lms-bar" style={vars({ '--_p': `${PROGRESS}%`, '--_t': `${completion}%` })}>
          <i />
          <b />
        </span>
      </p>
    </div>
  );
}
