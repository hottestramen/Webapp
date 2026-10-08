import { useMemo } from 'react';
import { useCommentStore } from '../../stores/commentStore';

/** 할일 id → 댓글 수(삭제된 댓글 제외, F-C-04) */
export function useCommentCounts(): Map<string, number> {
  const comments = useCommentStore((s) => s.comments);

  return useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of comments) {
      if (!c.deleted_at) counts.set(c.task_id, (counts.get(c.task_id) ?? 0) + 1);
    }
    return counts;
  }, [comments]);
}
