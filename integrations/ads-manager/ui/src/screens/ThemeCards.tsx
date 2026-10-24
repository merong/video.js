import { useId } from 'react';

import { contrastRatio, drawsNoBorder, type ThemeChoice } from './preset-form';

// The skin's own values where a card leaves a theme value empty (the editor's "스킨 기본" placeholders).
const SKIN_ACCENT = '#ffffff';
const SKIN_BORDER = 'rgb(0 0 0 / 0.15)';
const SKIN_RADIUS = 28;
// A 160×90 drawing stands for a player about 450px wide, so radii shrink to a third.
const RADIUS_SCALE = 1 / 3;

/** The text color `contrast-color()` would pick on `accent`. */
function autoText(accent: string): string {
  return contrastRatio(accent, '#000000') >= contrastRatio(accent, '#ffffff') ? '#000000' : '#ffffff';
}

/** A small player drawn from the card's theme values: frame, border, big play button, progress and a menu button. */
function ThemeThumb({ choice }: { choice: ThemeChoice }) {
  const accent = choice.accentColor || SKIN_ACCENT;
  const text = choice.accentTextColor || autoText(accent);
  const border =
    choice.borderColor === '' ? SKIN_BORDER : drawsNoBorder(choice.borderColor) ? 'none' : choice.borderColor;
  const radius = (choice.borderRadius === '' ? SKIN_RADIUS : Number(choice.borderRadius)) * RADIUS_SCALE;
  // `url(#…)` is read as CSS, where the punctuation in React ids would end the name.
  const shade = `shade-${useId().replace(/\W/g, '')}`;

  return (
    <svg className="aa-theme-thumb" viewBox="0 0 160 90" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={shade} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b4a63" />
          <stop offset="1" stopColor="#1c2230" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="158" height="88" rx={radius} fill={`url(#${shade})`} stroke={border} strokeWidth="2" />
      <path d="M1 70 L46 44 L72 58 L104 36 L159 66 V72 H1 Z" fill="#56657f" opacity="0.7" />
      <circle cx="80" cy="38" r="13" fill={accent} />
      <path d="M76 31 L87 38 L76 45 Z" fill={text} />
      <line
        x1="12"
        y1="70"
        x2="148"
        y2="70"
        stroke="#ffffff"
        strokeOpacity="0.35"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <line x1="12" y1="70" x2="74" y2="70" stroke={accent} strokeWidth="3" strokeLinecap="round" />
      <path d="M13 76 L20 80 L13 84 Z" fill="#ffffff" />
      <rect x="120" y="75" width="28" height="10" rx="5" fill={accent} />
      <path d="M131 77.5 L137 80 L131 82.5 Z" fill={text} />
    </svg>
  );
}

export interface ThemeCardsProps {
  choices: readonly ThemeChoice[];
  /** The card the form's values match; `undefined` while they were set by hand. */
  current: ThemeChoice | undefined;
  onPick: (choice: ThemeChoice) => void;
}

/**
 * Theme cards as one native radio group: Tab lands on the current card and the arrow keys pick the next one. No card is
 * checked while the values were set by hand, and the line under the cards says so.
 */
export function ThemeCards({ choices, current, onPick }: ThemeCardsProps) {
  const name = useId();

  return (
    <fieldset className="aa-fieldset" aria-describedby={`${name}-now`}>
      <legend className="sa-label">테마 고르기</legend>
      <div className={current ? 'aa-theme-cards' : 'aa-theme-cards is-custom'}>
        {choices.map((choice) => (
          <label className="aa-theme-card" key={choice.id}>
            <ThemeThumb choice={choice} />
            <span className="aa-theme-name">
              <input
                type="radio"
                name={name}
                value={choice.id}
                checked={choice.id === current?.id}
                onChange={() => onPick(choice)}
              />
              {choice.label}
            </span>
            <span className="sa-small">{choice.note}</span>
          </label>
        ))}
      </div>
      <span className="sa-help" id={`${name}-now`}>
        {current
          ? `지금 테마: ${current.label}. 세부 조정에서 값을 바꾸면 직접 조정으로 바뀌어요.`
          : '지금 테마: 직접 조정. 세부 조정에서 바꾼 값이에요. 카드를 고르면 그 테마 값으로 바뀌어요.'}
      </span>
    </fieldset>
  );
}
