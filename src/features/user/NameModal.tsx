import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../../components/Button';
import { NAME_MAX } from '../../lib/userName';
import { useUserStore } from '../../stores/userStore';

export const IDENTITY_LIMIT_NOTICE =
  '로그인이 없어 본인 확인을 하지 않습니다. 부서 내부에서만 사용하고 다른 사람 이름으로 작성하지 마세요.';

/**
 * 이름 입력 모달(첫 접속 / 이름 변경). 네이티브 <dialog>의 showModal()을 쓰므로
 * 포커스 가두기·Esc 닫기·닫을 때 포커스 복귀를 브라우저가 처리한다(PRD §5.3).
 */
export function NameModal() {
  const { name, members, modalOpen, submitName, closeModal } = useUserStore();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const ids = { input: useId(), error: useId(), notice: useId(), list: useId() };

  // 열릴 때 현재 이름으로 채우고, 닫힐 때 dialog 를 닫는다.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (modalOpen && !dialog.open) {
      setValue(name ?? '');
      setError(null);
      dialog.showModal();
      inputRef.current?.select();
    } else if (!modalOpen && dialog.open) {
      dialog.close();
    }
  }, [modalOpen, name]);

  const suggestions = members.filter((m) => m.active);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    const message = await submitName(value);
    setSaving(false);
    setError(message);
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`${ids.input}-title`}
      aria-describedby={ids.notice}
      // 이름이 없으면 Esc 로도 닫히지 않게 한다. 이름이 있으면 닫는다.
      onCancel={(event) => {
        event.preventDefault();
        closeModal();
      }}
      className="m-auto w-full max-w-modal rounded-lg border border-border bg-surface p-0 text-text shadow-raised backdrop:bg-overlay"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
        <h2 id={`${ids.input}-title`} className="text-xl font-bold">
          이름을 입력하세요
        </h2>

        <div className="flex flex-col gap-2">
          <label htmlFor={ids.input} className="text-sm font-semibold">
            이름 (필수, 1~{NAME_MAX}자)
          </label>
          <input
            ref={inputRef}
            id={ids.input}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            list={ids.list}
            autoComplete="off"
            maxLength={NAME_MAX + 10}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? ids.error : undefined}
            className="min-h-touch rounded-md border border-border bg-surface px-3 text-base"
          />
          <datalist id={ids.list}>
            {suggestions.map((m) => (
              <option key={m.id} value={m.name} />
            ))}
          </datalist>
          {error && (
            <p id={ids.error} role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
        </div>

        <p id={ids.notice} className="rounded-md bg-bg p-3 text-sm text-text-muted">
          {IDENTITY_LIMIT_NOTICE}
          <br />
          외부 공유 금지, 개인정보 입력 금지.
        </p>

        <div className="flex justify-end gap-2">
          {name !== null && (
            <Button onClick={closeModal} disabled={saving}>
              취소
            </Button>
          )}
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? '저장 중…' : '시작하기'}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
