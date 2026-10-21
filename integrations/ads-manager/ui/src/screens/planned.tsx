import { Note } from '../components';

export interface PlannedFeature {
  name: string;
  /** What works today instead, so the operator is not left guessing. */
  reason: string;
}

/** Contract 3.2 "준비 중" features, shown where an operator would look for them. */
export function PlannedNote({ features }: { features: readonly PlannedFeature[] }) {
  return (
    <Note tone="info" title="준비 중인 기능">
      <ul>
        {features.map(({ name, reason }) => (
          <li key={name}>
            <strong>{name} · 준비 중.</strong> {reason}
          </li>
        ))}
      </ul>
    </Note>
  );
}

/** GnuBoard only; a standalone site has no posts to insert into. */
export const SETUP_PLANNED: readonly PlannedFeature[] = [
  {
    name: '그누보드 게시물 자동 삽입',
    reason:
      '게시물에 플레이어를 자동으로 넣는 기능은 아직 없어요. 지금은 관리자를 사이트 아래 /ads/에 설치해 같은 출처로 쓰고, 설치 코드를 게시판 스킨이나 페이지에 직접 붙여 넣어 주세요.',
  },
];

export const LIST_PLANNED: readonly PlannedFeature[] = [
  {
    name: '프리셋 변경 이력과 되돌리기',
    reason: '저장하면 이전 값은 남지 않아요. 바꾸기 전 값을 지키려면 먼저 복제해 두세요.',
  },
];
