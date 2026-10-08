import { useEffect, useId, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../../components/Button';
import { formatCommentTime } from '../../lib/format';
import { COMMENT_MAX, validateComment } from '../../lib/taskValidation';
import { isTempId } from '../../lib/taskRules';
import { useCommentStore } from '../../stores/commentStore';
import { useUserStore } from '../../stores/userStore';

const TICK_MS = 30_000;

/** 상세 하단의 댓글 목록(작성 시각 오름차순)과 입력창. 수정은 없고 삭제만 가능하다(F-C-03). */
export function CommentSection({ taskId }: { taskId: string }) {
  const allComments = useCommentStore((s) => s.comments);
  // 본인이 쓴 댓글에만 삭제 버튼을 보인다. 로그인이 없어 이름이 같으면 구분할 수 없으므로
  // 사칭을 막는 보안 장치는 아니고, 실수로 남의 댓글을 지우는 것을 줄이는 용도다(PRD §5.6).
  const me = useUserStore((s) => s.name);
  const { addComment, deleteComment } = useCommentStore.getState();

  const comments = useMemo(
    () =>
      allComments
        .filter((c) => c.task_id === taskId)
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [allComments, taskId],
  );

  // "방금 전 / 5분 전" 표기가 시간이 지나면 갱신되도록 주기적으로 다시 그린다.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const baseId = useId();
  const inputId = `${baseId}-content`;
  const errorId = `${baseId}-error`;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const message = validateComment(content);
    setError(message);
    if (message) return;

    // 낙관적 업데이트: 댓글이 목록에 먼저 보이므로 입력창도 바로 비우고, 저장에 실패하면 되돌린다
    const text = content.trim();
    setContent('');
    setSaving(true);
    const ok = await addComment(taskId, text);
    setSaving(false);
    if (!ok) setContent(text);
  }

  return (
    <section aria-labelledby={`${baseId}-heading`} className="flex flex-col gap-3">
      <h3 id={`${baseId}-heading`} className="text-lg font-semibold">
        댓글 {comments.filter((c) => !c.deleted_at).length}개
      </h3>

      {comments.length === 0 ? (
        <p className="text-sm text-text-muted">아직 댓글이 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {comments.map((c) => (
            <li key={c.id} className="rounded-md border border-border bg-bg p-3">
              {c.deleted_at ? (
                <p className="text-sm text-text-muted">삭제된 댓글입니다</p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm">
                      <span className="font-semibold">{c.author_name}</span>
                      <span className="text-text-muted">
                        {' '}
                        · {formatCommentTime(c.created_at, now)}
                      </span>
                    </p>
                    {!isTempId(c.id) && c.author_name === me && (
                      <Button
                        onClick={() => {
                          if (window.confirm('이 댓글을 삭제할까요?')) void deleteComment(c.id);
                        }}
                        aria-label={`${c.author_name}의 댓글 삭제`}
                      >
                        삭제
                      </Button>
                    )}
                  </div>
                  {/* 사용자 입력은 항상 텍스트로만 렌더한다 */}
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm">{c.content}</p>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-2">
        <label htmlFor={inputId} className="text-sm font-semibold">
          댓글 쓰기 (최대 {COMMENT_MAX.toLocaleString()}자)
        </label>
        <textarea
          id={inputId}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-base text-text"
        />
        {error && (
          <p id={errorId} role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end">
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? '저장 중…' : '댓글 등록'}
          </Button>
        </div>
      </form>
    </section>
  );
}
