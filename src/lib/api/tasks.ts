import { supabase } from '../supabase';
import { fetchAllPages } from './paginate';
import type { Task, TaskInsert, TaskUpdate } from '../../types';
import { ApiError, ConflictError, toApiError, unwrap } from './errors';

// 삭제된 행(deleted_at)은 RLS 가 이미 걸러 준다. 그래도 의도를 드러내려고 조건을 한 번 더 둔다.
export async function listTasks(): Promise<Task[]> {
  return fetchAllPages<Task>((from, to) =>
    supabase
      .from('tasks')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .order('id')
      .range(from, to),
  );
}

/** 한 건을 읽는다. 없거나 삭제됐으면 null. */
export async function getTask(id: string): Promise<Task | null> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw toApiError(error);
  return (data as Task | null) ?? null;
}

export async function createTask(input: TaskInsert): Promise<Task> {
  return unwrap<Task>(await supabase.from('tasks').insert(input).select().single());
}

/**
 * 할일 수정. `expectedUpdatedAt` 을 주면 `updated_at = 기준값` 조건으로 보내고(PRD §5.8),
 * 0행이 갱신되면 ConflictError 를 던진다. 주지 않으면 조건 없이 저장한다(last-write-wins).
 */
export async function updateTask(
  id: string,
  patch: TaskUpdate,
  options: { expectedUpdatedAt?: string } = {},
): Promise<Task> {
  let query = supabase.from('tasks').update(patch).eq('id', id);
  if (options.expectedUpdatedAt) query = query.eq('updated_at', options.expectedUpdatedAt);

  const { data, error } = await query.select();
  if (error) throw toApiError(error);

  const row = (data as Task[])[0];
  if (!row) {
    if (options.expectedUpdatedAt) throw new ConflictError();
    throw new ApiError('수정할 항목을 찾을 수 없습니다.');
  }
  return row;
}

/**
 * 소프트 삭제(deleted_at 갱신). anon 이 직접 UPDATE 하면 갱신된 행이 SELECT 정책에 걸려
 * RLS 오류가 나므로 002_rls.sql 의 함수(soft_delete_task)로 호출한다.
 */
export async function softDeleteTask(id: string, updatedBy: string): Promise<void> {
  const { error } = await supabase.rpc('soft_delete_task', { p_id: id, p_updated_by: updatedBy });
  if (error) throw toApiError(error);
}

/** 삭제 직후(1분 이내) 실행 취소. */
export async function restoreTask(id: string, updatedBy: string): Promise<void> {
  const { error } = await supabase.rpc('restore_task', { p_id: id, p_updated_by: updatedBy });
  if (error) throw toApiError(error);
}
