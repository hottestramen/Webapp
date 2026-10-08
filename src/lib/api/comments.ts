import { supabase } from '../supabase';
import { fetchAllPages } from './paginate';
import type { Comment, CommentInsert } from '../../types';
import { toApiError, unwrap } from './errors';

/** 작성 시각 오름차순(F-C-02). taskId 를 주면 그 할일의 댓글만 가져온다. */
export async function listComments(taskId?: string): Promise<Comment[]> {
  return fetchAllPages<Comment>((from, to) => {
    let query = supabase.from('comments').select('*').is('deleted_at', null);
    if (taskId) query = query.eq('task_id', taskId);
    return query.order('created_at', { ascending: true }).order('id').range(from, to);
  });
}

export async function createComment(input: CommentInsert): Promise<Comment> {
  return unwrap<Comment>(await supabase.from('comments').insert(input).select().single());
}

// 댓글은 수정할 수 없다(PRD F-C-03). updateComment 는 만들지 않는다.

/** 소프트 삭제. tasks 와 같은 이유로 함수(soft_delete_comment)로 호출한다. */
export async function softDeleteComment(id: string): Promise<void> {
  const { error } = await supabase.rpc('soft_delete_comment', { p_id: id });
  if (error) throw toApiError(error);
}
