import { useShallow } from 'zustand/react/shallow';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { Button } from '../../components/Button';
import { DUE_STATUS_LABEL, PRIORITY_LABEL, STATUS_LABEL } from '../../lib/labels';
import { pickFilters, useFilterStore } from '../../stores/filterStore';
import { useTaskStore } from '../../stores/taskStore';
import { TASK_PRIORITIES, TASK_STATUSES } from '../../types';
import { hasActiveFilters, UNASSIGNED } from './applyFilters';

interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: () => void;
}

function Checkbox({ label, checked, onChange }: CheckboxProps) {
  const id = useId();
  return (
    <div className="flex min-h-touch items-center gap-2">
      <input id={id} type="checkbox" checked={checked} onChange={onChange} className="h-5 w-5" />
      <label htmlFor={id} className="flex-1 text-sm">
        {label}
      </label>
    </div>
  );
}

function Group({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col">
      <legend className="mb-1 text-sm font-semibold">{legend}</legend>
      {children}
    </fieldset>
  );
}

/** 상태·우선순위·담당자·카테고리 필터와 "내 할일만". 사이드바·접이식 패널·바텀시트에서 같이 쓴다. */
export function FilterPanel() {
  const filters = useFilterStore(useShallow(pickFilters));
  const toggleValue = useFilterStore((s) => s.toggleValue);
  const setMineOnly = useFilterStore((s) => s.setMineOnly);
  const clear = useFilterStore((s) => s.clear);
  const members = useTaskStore((s) => s.members);
  const categories = useTaskStore((s) => s.categories);

  return (
    <div className="flex flex-col gap-4">
      <Checkbox
        label="내 할일만"
        checked={filters.mineOnly}
        onChange={() => setMineOnly(!filters.mineOnly)}
      />

      <Group legend="상태">
        {TASK_STATUSES.map((s) => (
          <Checkbox
            key={s}
            label={STATUS_LABEL[s]}
            checked={filters.statuses.includes(s)}
            onChange={() => toggleValue('statuses', s)}
          />
        ))}
      </Group>

      <Group legend="우선순위">
        {TASK_PRIORITIES.map((p) => (
          <Checkbox
            key={p}
            label={PRIORITY_LABEL[p]}
            checked={filters.priorities.includes(p)}
            onChange={() => toggleValue('priorities', p)}
          />
        ))}
      </Group>

      <Group legend="마감">
        {(['soon', 'overdue'] as const).map((d) => (
          <Checkbox
            key={d}
            label={DUE_STATUS_LABEL[d]}
            checked={filters.dueStatuses.includes(d)}
            onChange={() => toggleValue('dueStatuses', d)}
          />
        ))}
      </Group>

      <Group legend="담당자">
        <Checkbox
          label="미지정"
          checked={filters.assigneeIds.includes(UNASSIGNED)}
          onChange={() => toggleValue('assigneeIds', UNASSIGNED)}
        />
        {members
          .filter((m) => m.active)
          .map((m) => (
            <Checkbox
              key={m.id}
              label={m.name}
              checked={filters.assigneeIds.includes(m.id)}
              onChange={() => toggleValue('assigneeIds', m.id)}
            />
          ))}
      </Group>

      <Group legend="카테고리">
        {categories
          .filter((c) => c.active)
          .map((c) => (
            <Checkbox
              key={c.id}
              label={c.name}
              checked={filters.categoryIds.includes(c.id)}
              onChange={() => toggleValue('categoryIds', c.id)}
            />
          ))}
      </Group>

      <Button onClick={clear} disabled={!hasActiveFilters(filters)}>
        전체 초기화
      </Button>
    </div>
  );
}
