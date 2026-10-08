import { supabase } from '../supabase';
import type { Leave, LeaveInsert, LeaveUpdate } from '../../types';
import { toApiError, unwrap } from './errors';
import { fetchAllPages } from './paginate';

/** 삭제되지 않은 휴가 전체(시작일 순) */
export async function listLeaves(): Promise<Leave[]> {
  return fetchAllPages<Leave>((from, to) =>
    supabase
      .from('leaves')
      .select('*')
      .is('deleted_at', null)
      .order('start_date', { ascending: true })
      .order('id')
      .range(from, to),
  );
}

export async function createLeave(input: LeaveInsert): Promise<Leave> {
  return unwrap<Leave>(await supabase.from('leaves').insert(input).select().single());
}

export async function updateLeave(id: string, patch: LeaveUpdate): Promise<Leave> {
  return unwrap<Leave>(await supabase.from('leaves').update(patch).eq('id', id).select().single());
}

/**
 * 소프트 삭제(deleted_at 갱신). 할일·댓글과 같은 이유로 DB 함수(soft_delete_leave)로 호출한다.
 */
export async function softDeleteLeave(id: string): Promise<void> {
  const { error } = await supabase.rpc('soft_delete_leave', { p_id: id });
  if (error) throw toApiError(error);
}
