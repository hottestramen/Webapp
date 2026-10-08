import type { Task } from '../types';

export type ConflictKey =
  'title' | 'description' | 'status' | 'priority' | 'assignee' | 'category' | 'due';

type MineFields = Pick<
  Task,
  'title' | 'description' | 'status' | 'priority' | 'assignee_id' | 'category_id' | 'due_date'
>;

/**
 * 동시 편집 충돌(§5.8)이 났을 때, 내가 입력한 값과 서버의 최신 값이 다른 필드를 찾는다.
 * "최신 내용 보기" 후 이 필드들 옆에 "내 입력값"을 보여 준다.
 */
export function conflictingFields(mine: MineFields, server: Task): ConflictKey[] {
  const keys: ConflictKey[] = [];
  if (mine.title !== server.title) keys.push('title');
  if ((mine.description ?? null) !== (server.description ?? null)) keys.push('description');
  if (mine.status !== server.status) keys.push('status');
  if (mine.priority !== server.priority) keys.push('priority');
  if ((mine.assignee_id ?? null) !== (server.assignee_id ?? null)) keys.push('assignee');
  if ((mine.category_id ?? null) !== (server.category_id ?? null)) keys.push('category');
  if ((mine.due_date ?? null) !== (server.due_date ?? null)) keys.push('due');
  return keys;
}

/**
 * "내 입력값"으로 보여 줄 필드: 서버의 최신 값과 다르면서, 내가 폼을 열었을 때의 값(initial)에서
 * 실제로 바꾼 필드만. 내가 건드리지 않았는데 상대가 바꾼 필드는 제외한다.
 */
export function myConflictingEdits(
  mine: MineFields,
  initial: MineFields,
  server: Task,
): ConflictKey[] {
  const changedByMe = new Set(conflictingFields(mine, { ...server, ...initial }));
  return conflictingFields(mine, server).filter((key) => changedByMe.has(key));
}
