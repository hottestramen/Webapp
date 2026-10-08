import { AVATAR_CLASS } from '../lib/labels';
import type { Member } from '../types';

/** 팀원의 색(토큰) 아바타. 이름의 첫 글자를 보여 주며 장식용이라 스크린리더에서는 숨긴다. */
export function MemberAvatar({ member }: { member: Pick<Member, 'name' | 'color'> }) {
  const initial = Array.from(member.name)[0] ?? '';
  // 첫 글자는 CSS(::before)로 그린다. DOM 글자로 두면 버튼의 "보이는 글자"에 섞여 접근 가능한 이름과 어긋난다.
  return (
    <span
      aria-hidden="true"
      data-initial={initial}
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-pill text-xs font-semibold text-avatar-text before:content-[attr(data-initial)] ${AVATAR_CLASS[member.color]}`}
    />
  );
}

/** 아바타 색(토큰) + 이름. 담당자가 없으면 "미지정". */
export function Assignee({ member }: { member: Member | undefined }) {
  if (!member) return <span className="text-xs text-text-muted">담당자 미지정</span>;

  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <MemberAvatar member={member} />
      <span className="truncate text-xs text-text">{member.name}</span>
    </span>
  );
}
