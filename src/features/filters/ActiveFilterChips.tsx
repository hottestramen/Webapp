import { useShallow } from 'zustand/react/shallow';
import { useMemo } from 'react';
import { Button } from '../../components/Button';
import { DUE_STATUS_LABEL, PRIORITY_LABEL, STATUS_LABEL } from '../../lib/labels';
import { pickFilters, useFilterStore } from '../../stores/filterStore';
import { useTaskStore } from '../../stores/taskStore';
import { hasActiveFilters, UNASSIGNED } from './applyFilters';

interface Chip {
  key: string;
  label: string;
  onRemove: () => void;
}

/** 적용된 조건을 칩으로 보여 주고, 칩별 해제와 "전체 초기화"를 제공한다(F-S-04). */
export function ActiveFilterChips() {
  const filters = useFilterStore(useShallow(pickFilters));
  const clear = useFilterStore((s) => s.clear);
  const members = useTaskStore((s) => s.members);
  const categories = useTaskStore((s) => s.categories);

  const chips = useMemo<Chip[]>(() => {
    const list: Chip[] = [];
    const store = useFilterStore.getState();
    if (filters.query.trim()) {
      list.push({
        key: 'q',
        label: `검색: ${filters.query.trim()}`,
        onRemove: () => store.setQuery(''),
      });
    }
    if (filters.mineOnly) {
      list.push({ key: 'mine', label: '내 할일만', onRemove: () => store.setMineOnly(false) });
    }
    for (const s of filters.statuses) {
      list.push({
        key: `status-${s}`,
        label: `상태: ${STATUS_LABEL[s]}`,
        onRemove: () => store.removeValue('statuses', s),
      });
    }
    for (const p of filters.priorities) {
      list.push({
        key: `priority-${p}`,
        label: `우선순위: ${PRIORITY_LABEL[p]}`,
        onRemove: () => store.removeValue('priorities', p),
      });
    }
    for (const d of filters.dueStatuses) {
      list.push({
        key: `due-${d}`,
        label: `마감: ${DUE_STATUS_LABEL[d]}`,
        onRemove: () => store.removeValue('dueStatuses', d),
      });
    }
    for (const id of filters.assigneeIds) {
      const name =
        id === UNASSIGNED ? '미지정' : (members.find((m) => m.id === id)?.name ?? '알 수 없음');
      list.push({
        key: `assignee-${id}`,
        label: `담당자: ${name}`,
        onRemove: () => store.removeValue('assigneeIds', id),
      });
    }
    for (const id of filters.categoryIds) {
      list.push({
        key: `category-${id}`,
        label: `카테고리: ${categories.find((c) => c.id === id)?.name ?? '알 수 없음'}`,
        onRemove: () => store.removeValue('categoryIds', id),
      });
    }
    return list;
  }, [filters, members, categories]);

  if (!hasActiveFilters(filters)) return null;

  return (
    <ul aria-label="적용된 조건" className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <li key={chip.key}>
          <span className="inline-flex min-h-touch items-center gap-1 rounded-pill border border-border bg-surface pl-3 text-sm">
            {chip.label}
            <button
              type="button"
              onClick={chip.onRemove}
              aria-label={`조건 해제: ${chip.label}`}
              className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-pill text-text-muted"
            >
              <span aria-hidden="true">×</span>
            </button>
          </span>
        </li>
      ))}
      <li>
        <Button onClick={clear}>전체 초기화</Button>
      </li>
    </ul>
  );
}
