import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../../components/Button';
import { formatDueDate } from '../../lib/format';
import { useTaskStore } from '../../stores/taskStore';
import { FormError, SettingsSection, textInputClass } from './SettingsSection';

const NAME_MAX = 30;

/** 임시공휴일 추가(날짜 + 이름). 등록한 공휴일은 캘린더에 빨간색으로 표시된다. */
export function HolidaysSettings() {
  const holidays = useTaskStore((s) => s.holidays);
  const addHoliday = useTaskStore((s) => s.addHoliday);
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dateId = useId();
  const nameId = useId();
  const errorId = useId();

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const message = await addHoliday(date, name);
    setBusy(false);
    setError(message);
    if (!message) {
      setDate('');
      setName('');
    }
  }

  return (
    <SettingsSection
      title="임시공휴일"
      description="법정 공휴일(2026~2027년)은 미리 등록되어 있습니다. 임시공휴일은 여기서 추가합니다. 잘못 등록한 항목의 수정·삭제는 관리자가 Supabase 콘솔에서 합니다."
    >
      <form onSubmit={handleAdd} noValidate className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={dateId} className="text-sm font-semibold">
            날짜
          </label>
          <input
            id={dateId}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-describedby={error ? errorId : undefined}
            className={textInputClass}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor={nameId} className="text-sm font-semibold">
            이름 (1~{NAME_MAX}자)
          </label>
          <input
            id={nameId}
            type="text"
            value={name}
            maxLength={NAME_MAX + 10}
            onChange={(e) => setName(e.target.value)}
            aria-describedby={error ? errorId : undefined}
            className={textInputClass}
          />
        </div>
        <Button type="submit" variant="primary" disabled={busy}>
          공휴일 추가
        </Button>
      </form>
      <FormError id={errorId} message={error} />

      <details>
        <summary className="min-h-touch cursor-pointer py-2 text-sm font-semibold">
          등록된 공휴일 {holidays.length}개 보기
        </summary>
        <ul className="flex flex-col gap-1 text-sm">
          {holidays.map((h) => (
            <li key={h.date} className="flex gap-3 border-b border-border py-1 last:border-b-0">
              <span className="w-1/2 shrink-0 text-text-muted">
                {h.date.slice(0, 4)}년 {formatDueDate(h.date)}
              </span>
              <span>{h.name}</span>
            </li>
          ))}
        </ul>
      </details>
    </SettingsSection>
  );
}
