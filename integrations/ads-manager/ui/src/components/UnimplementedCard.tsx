import { type ReactNode, useId } from 'react';

export interface UnimplementedCardProps {
  /** Screen name, e.g. "지면 편성". */
  title: string;
  /** What the screen will let people do. */
  purpose: ReactNode;
  /** Repository path of the planning document, optionally with its section. */
  specPath: string;
  /** Use 3 when the card sits under a section that already has an `h2`. */
  headingLevel?: 2 | 3 | undefined;
}

/** Placeholder for a menu screen that is not built yet. */
export function UnimplementedCard({ title, purpose, specPath, headingLevel = 2 }: UnimplementedCardProps) {
  const titleId = useId();
  const Heading = headingLevel === 3 ? 'h3' : 'h2';

  return (
    <section className="sa-card is-unbuilt" aria-labelledby={titleId}>
      <span className="sa-mock">아직 만들지 않은 화면</span>
      <Heading className="sa-card-title" id={titleId}>
        {title}
      </Heading>
      <p className="sa-body">{purpose}</p>
      <p className="sa-small">
        기획 문서 <code className="sa-code">{specPath}</code>
      </p>
    </section>
  );
}
