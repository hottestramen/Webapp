import { create } from 'zustand';
import { createComment, softDeleteComment } from '../lib/api';
import { clearPending, isPending, markPending } from '../lib/pending';
import { newId } from '../lib/uuid';
import type { Comment } from '../types';
import { toast } from './toastStore';
import { useUserStore } from './userStore';

interface CommentState {
  /** 모든 할일의 댓글(카드의 댓글 수 표시용). 삭제된 댓글은 이번 세션에서만 deleted_at 이 채워진 채 남는다. */
  comments: Comment[];
  setComments: (comments: Comment[]) => void;
  /** 전체 다시 불러오기 결과를 합친다. 저장 중인 내 댓글과 이번 세션에서 삭제 표시한 댓글은 유지한다. */
  mergeSnapshot: (comments: Comment[]) => void;
  /** 실시간으로 받은 댓글(INSERT). 같은 id 가 이미 있으면 무시한다. */
  applyRemoteComment: (row: Comment) => void;
  /** 다른 팀원이 삭제한 댓글을 "삭제된 댓글입니다"로 표시한다. */
  markRemoteDeleted: (id: string) => void;
  addComment: (taskId: string, content: string) => Promise<boolean>;
  /** 소프트 삭제. 댓글은 수정할 수 없고 삭제만 가능하다(F-C-03). */
  deleteComment: (id: string) => Promise<void>;
}

export const useCommentStore = create<CommentState>((set, get) => ({
  comments: [],

  setComments: (comments) => set({ comments }),

  mergeSnapshot: (incoming) =>
    set((s) => {
      const serverIds = new Set(incoming.map((c) => c.id));
      const keep = s.comments.filter(
        (c) => !serverIds.has(c.id) && (isPending(c.id) || c.deleted_at !== null),
      );
      return { comments: [...incoming, ...keep] };
    }),

  applyRemoteComment: (row) =>
    set((s) => {
      if (s.comments.some((c) => c.id === row.id)) {
        return { comments: s.comments.map((c) => (c.id === row.id && !isPending(c.id) ? row : c)) };
      }
      return row.deleted_at ? s : { comments: [...s.comments, row] };
    }),

  markRemoteDeleted: (id) =>
    set((s) => ({
      comments: s.comments.map((c) =>
        c.id === id && !c.deleted_at ? { ...c, deleted_at: new Date().toISOString() } : c,
      ),
    })),

  addComment: async (taskId, content) => {
    const author = useUserStore.getState().name;
    if (!author) {
      toast.error('먼저 이름을 입력하세요.');
      return false;
    }

    // id 를 미리 정해 두면 실시간으로 되돌아온 내 댓글이 중복으로 들어오지 않는다.
    const id = newId();
    const optimistic: Comment = {
      id,
      task_id: taskId,
      author_name: author,
      content,
      created_at: new Date().toISOString(),
      deleted_at: null,
    };
    markPending(id);
    set((s) => ({ comments: [...s.comments, optimistic] }));

    try {
      const saved = await createComment({ id, task_id: taskId, author_name: author, content });
      clearPending(id);
      set((s) => ({ comments: s.comments.map((c) => (c.id === id ? saved : c)) }));
      return true;
    } catch {
      clearPending(id);
      set((s) => ({ comments: s.comments.filter((c) => c.id !== id) }));
      toast.error('댓글을 저장하지 못했습니다.');
      return false;
    }
  },

  deleteComment: async (id) => {
    const prev = get().comments.find((c) => c.id === id);
    if (!prev) return;

    const markDeleted = (deletedAt: string | null) =>
      set((s) => ({
        comments: s.comments.map((c) => (c.id === id ? { ...c, deleted_at: deletedAt } : c)),
      }));

    markDeleted(new Date().toISOString());
    try {
      await softDeleteComment(id);
    } catch {
      markDeleted(null);
      toast.error('댓글을 삭제하지 못했습니다.');
    }
  },
}));
