export type AdTier = 'period' | 'guaranteed' | 'house';

export const TIER_LABELS = {
  period: '기간제',
  guaranteed: '보장',
  house: '하우스',
} satisfies Record<AdTier, string>;

export interface TierTagProps {
  tier: AdTier;
  label?: string | undefined;
}

export function TierTag({ tier, label }: TierTagProps) {
  return <span className={`sa-tag is-${tier}`}>{label ?? TIER_LABELS[tier]}</span>;
}
