import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../../components/Button';
import { AVATAR_CLASS, AVATAR_KEYS } from '../../lib/labels';
import { NAME_MAX } from '../../lib/userName';
import { useTaskStore } from '../../stores/taskStore';
import type { Member } from '../../types';
import { ColorPicker } from './ColorPicker';
import { FormError, SettingsSection, textInputClass } from './SettingsSection';

function MemberRow({ member }: { member: Member }) {
  const renameMember = useTaskStore((s) => s.renameMember);
  const setMemberActive = useTaskStore((s) => s.setMemberActive);
  const setMemberColor = useTaskStore((s) => s.setMemberColor);
  const [name, setName] = useState(member.name);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputId = useId();
  const errorId = useId();

  async function run(action: () => Promise<string | null>) {
    setBusy(true);
    setError(await action());
    setBusy(false);
  }

  return (
    <li
      className={`flex flex-col gap-2 rounded-md border border-border p-3 ${
        member.active ? 'bg-surface' : 'bg-bg'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          aria-hidden="true"
          className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-pill text-sm font-semibold text-avatar-text ${AVATAR_CLASS[member.color]}`}
        >
          {Array.from(member.name)[0] ?? ''}
        </span>

        <label htmlFor={inputId} className="sr-only">
          {member.name} 이름 변경
        </label>
        <input
          id={inputId}
          type="text"
          value={name}
          maxLength={NAME_MAX + 10}
          onChange={(e) => setName(e.target.value)}
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error ? true : undefined}
          className={`${textInputClass} min-w-0 flex-1`}
        />

        <Button
          disabled={busy || name.trim() === member.name}
          onClick={() => void run(() => renameMember(member.id, name))}
        >
          이름 저장
        </Button>
        <Button
          disabled={busy}
          onClick={() => void run(() => setMemberActive(member.id, !member.active))}
        >
          {member.active ? '비활성화' : '다시 활성화'}
        </Button>
      </div>

      {!member.active && (
        <p className="text-xs text-text-muted">
          비활성 팀원입니다. 담당자 선택 목록에는 나오지 않고, 기존 할일에는 이름이 그대로 남습니다.
        </p>
      )}

      <details>
        <summary className="min-h-touch cursor-pointer py-2 text-sm font-semibold">
          아바타 색
        </summary>
        <ColorPicker
          label={`${member.name} 아바타 색`}
          keys={AVATAR_KEYS}
          classes={AVATAR_CLASS}
          value={member.color}
          disabled={busy}
          onChange={(color) => void run(() => setMemberColor(member.id, color))}
        />
      </details>

      <FormError id={errorId} message={error} />
    </li>
  );
}

/** 팀원 추가·이름 변경·비활성화/재활성화·아바타 색(F-U-04). 삭제는 없다. */
export function MembersSettings() {
  const members = useTaskStore((s) => s.members);
  const addMember = useTaskStore((s) => s.addMember);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputId = useId();
  const errorId = useId();

  // 활성 팀원을 먼저, 그다음 비활성 팀원
  const sorted = [...members].sort((a, b) => Number(b.active) - Number(a.active));

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const message = await addMember(name);
    setBusy(false);
    setError(message);
    if (!message) setName('');
  }

  return (
    <SettingsSection
      title="팀원 관리"
      description="같은 이름의 팀원이 있으면 구분할 수 없으니 “김하늘(기획)”처럼 소속을 붙여 등록하세요. 팀원은 삭제하지 않고 비활성화만 할 수 있습니다."
    >
      <form onSubmit={handleAdd} noValidate className="flex flex-wrap items-end gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor={inputId} className="text-sm font-semibold">
            새 팀원 이름 (1~{NAME_MAX}자)
          </label>
          <input
            id={inputId}
            type="text"
            value={name}
            maxLength={NAME_MAX + 10}
            onChange={(e) => setName(e.target.value)}
            aria-describedby={error ? errorId : undefined}
            aria-invalid={error ? true : undefined}
            className={textInputClass}
          />
        </div>
        <Button type="submit" variant="primary" disabled={busy}>
          팀원 추가
        </Button>
      </form>
      <FormError id={errorId} message={error} />

      <ul className="flex flex-col gap-2">
        {sorted.map((m) => (
          <MemberRow key={m.id} member={m} />
        ))}
      </ul>
    </SettingsSection>
  );
}
