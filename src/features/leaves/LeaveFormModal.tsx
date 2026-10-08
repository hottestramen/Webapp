import { useId, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { LEAVE_KIND_LABEL } from '../../lib/labels';
import { isHalfDayKind, isTripKind, LEAVE_NOTE_MAX, validateLeaveForm } from '../../lib/leaves';
import type { LeaveFormErrors } from '../../lib/leaves';
import { useLeaveStore } from '../../stores/leaveStore';
import { useTaskStore } from '../../stores/taskStore';
import { useTodayStore } from '../../stores/todayStore';
import { useUserStore } from '../../stores/userStore';
import { LEAVE_KINDS } from '../../types';
import type { Leave, LeaveKind } from '../../types';
import { inputClass } from '../tasks/TaskForm';

interface LeaveFormModalProps {
  open: boolean;
  onClose: () => void;
  /** 있으면 수정(삭제 버튼 표시), 없으면 새로 등록 */
  leave?: Leave;
  /** 새로 등록할 때의 종류: 휴가 또는 출장(수정할 때는 기존 종류를 따른다) */
  mode?: 'leave' | 'trip';
  /** 새로 등록할 때의 시작일 초깃값(캘린더에서 날짜를 눌러 열 때) */
  defaultDate?: string;
}

function Field({
  id,
  label,
  required,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
        {required && <span className="text-text-muted"> (필수)</span>}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

const describedBy = (id: string, hint: boolean, error: boolean) =>
  [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;

/** 휴가 등록·수정 모달: 팀원, 종류, 기간, 메모 */
export function LeaveFormModal({ open, onClose, leave, defaultDate, mode }: LeaveFormModalProps) {
  const titleId = useId();
  const trip = leave ? isTripKind(leave.kind) : mode === 'trip';
  const noun = trip ? '출장' : '휴가';

  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId} size="md">
      <div className="flex flex-col gap-4 p-5">
        <h2 id={titleId} className="text-xl font-bold">
          {leave ? `${noun} 수정` : `${noun} 등록`}
        </h2>
        <LeaveForm leave={leave} defaultDate={defaultDate} trip={trip} onClose={onClose} />
      </div>
    </Modal>
  );
}

function LeaveForm({
  leave,
  defaultDate,
  trip,
  onClose,
}: {
  leave?: Leave;
  defaultDate?: string;
  trip: boolean;
  onClose: () => void;
}) {
  const members = useTaskStore((s) => s.members);
  const userName = useUserStore((s) => s.name);
  const today = useTodayStore((s) => s.today);
  const baseId = useId();
  const id = (name: string) => `${baseId}-${name}`;

  const activeMembers = members.filter((m) => m.active);
  // 이미 비활성인 팀원의 휴가를 수정할 때는 그 팀원도 목록에 보여 준다
  const selectable =
    leave && !activeMembers.some((m) => m.id === leave.member_id)
      ? [...activeMembers, ...members.filter((m) => m.id === leave.member_id)]
      : activeMembers;
  const me = activeMembers.find((m) => m.name === userName);

  const startInit = leave?.start_date ?? defaultDate ?? today;
  const [memberId, setMemberId] = useState(leave?.member_id ?? me?.id ?? '');
  const [kind, setKind] = useState<LeaveKind>(leave?.kind ?? (trip ? 'trip' : 'annual'));
  const [startDate, setStartDate] = useState(startInit);
  const [endDate, setEndDate] = useState(leave?.end_date ?? startInit);
  const [note, setNote] = useState(leave?.note ?? '');
  const [errors, setErrors] = useState<LeaveFormErrors>({});
  const [saving, setSaving] = useState(false);

  const half = isHalfDayKind(kind);

  function changeStart(value: string) {
    setStartDate(value);
    // 종료일이 시작일보다 빠르면 시작일에 맞춘다
    if (!endDate || endDate < value) setEndDate(value);
  }

  function changeKind(value: LeaveKind) {
    setKind(value);
    if (isHalfDayKind(value)) setEndDate(startDate); // 반차는 하루
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateLeaveForm({ memberId, kind, startDate, endDate, note });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    const fields = {
      member_id: memberId,
      kind,
      start_date: startDate,
      end_date: half ? startDate : endDate,
      note: note.trim() ? note.trim() : null,
    };
    const { addLeave, editLeave } = useLeaveStore.getState();
    const ok = leave ? await editLeave(leave.id, fields) : await addLeave(fields);
    setSaving(false);
    if (ok) onClose();
  }

  async function handleDelete() {
    if (!leave) return;
    if (!window.confirm(`이 ${trip ? '출장' : '휴가'}을 삭제할까요?`)) return;
    setSaving(true);
    const ok = await useLeaveStore.getState().deleteLeave(leave.id);
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <Field id={id('member')} label="팀원" required error={errors.memberId}>
        <select
          id={id('member')}
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
          aria-invalid={errors.memberId ? true : undefined}
          aria-describedby={describedBy(id('member'), false, Boolean(errors.memberId))}
          className={inputClass}
        >
          <option value="">선택하세요</option>
          {selectable.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </Field>

      {!trip && (
        <Field id={id('kind')} label="종류">
          <select
            id={id('kind')}
            value={kind}
            onChange={(e) => changeKind(e.target.value as LeaveKind)}
            className={inputClass}
          >
            {LEAVE_KINDS.filter((k) => !isTripKind(k)).map((k) => (
              <option key={k} value={k}>
                {LEAVE_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </Field>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field id={id('start')} label={half ? '날짜' : '시작일'} required error={errors.startDate}>
          <input
            id={id('start')}
            type="date"
            value={startDate}
            onChange={(e) => changeStart(e.target.value)}
            aria-invalid={errors.startDate ? true : undefined}
            aria-describedby={describedBy(id('start'), false, Boolean(errors.startDate))}
            className={inputClass}
          />
        </Field>

        {!half && (
          <Field
            id={id('end')}
            label="종료일"
            required
            error={errors.endDate}
            hint="주말·공휴일은 캘린더에 표시되지 않습니다."
          >
            <input
              id={id('end')}
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
              aria-invalid={errors.endDate ? true : undefined}
              aria-describedby={describedBy(id('end'), true, Boolean(errors.endDate))}
              className={inputClass}
            />
          </Field>
        )}
      </div>

      <Field
        id={id('note')}
        label={trip ? '출장지·메모' : '메모'}
        error={errors.note}
        hint={`${note.length} / ${LEAVE_NOTE_MAX}자 · ${
          trip ? '출장지나 목적을 짧게 적으세요.' : '사유 등 개인정보는 적지 마세요.'
        }`}
      >
        <input
          id={id('note')}
          type="text"
          value={note}
          maxLength={LEAVE_NOTE_MAX + 10}
          onChange={(e) => setNote(e.target.value)}
          aria-invalid={errors.note ? true : undefined}
          aria-describedby={describedBy(id('note'), true, Boolean(errors.note))}
          className={inputClass}
        />
      </Field>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {leave ? (
          <Button onClick={() => void handleDelete()} disabled={saving}>
            삭제
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button onClick={onClose} disabled={saving}>
            취소
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? '저장 중…' : leave ? '저장' : '등록'}
          </Button>
        </div>
      </div>
    </form>
  );
}
