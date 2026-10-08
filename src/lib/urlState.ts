import { EMPTY_FILTERS } from '../features/filters/applyFilters';
import type { FilterState } from '../features/filters/applyFilters';
import { VIEWS } from '../components/views';
import type { ViewId } from '../components/views';
import type { DueStatus } from './dueStatus';
import { TASK_PRIORITIES, TASK_STATUSES } from '../types';

export interface UrlState {
  filters: FilterState;
  /** URL 에 view 가 없거나 올바르지 않으면 null */
  view: ViewId | null;
}

const list = (value: string | null): string[] =>
  value
    ? value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
    : [];

/** ?q=&status=&priority=&assignee=&category=&due=&mine=&view= → 상태 (F-S-05) */
export function parseUrlState(search: string): UrlState {
  const params = new URLSearchParams(search);
  const view = params.get('view');

  return {
    filters: {
      query: params.get('q') ?? '',
      statuses: list(params.get('status')).filter((v): v is FilterState['statuses'][number] =>
        (TASK_STATUSES as readonly string[]).includes(v),
      ),
      priorities: list(params.get('priority')).filter((v): v is FilterState['priorities'][number] =>
        (TASK_PRIORITIES as readonly string[]).includes(v),
      ),
      assigneeIds: list(params.get('assignee')),
      categoryIds: list(params.get('category')),
      dueStatuses: list(params.get('due')).filter(
        (v): v is DueStatus => v === 'soon' || v === 'overdue',
      ),
      mineOnly: params.get('mine') === '1',
    },
    view: VIEWS.some((v) => v.id === view) ? (view as ViewId) : null,
  };
}

/** 상태 → 쿼리 문자열('?...'). 기본값인 항목은 넣지 않는다. */
export function serializeUrlState(filters: FilterState, view: ViewId): string {
  const params = new URLSearchParams();
  const query = filters.query.trim();
  if (query) params.set('q', query);
  if (filters.statuses.length) params.set('status', filters.statuses.join(','));
  if (filters.priorities.length) params.set('priority', filters.priorities.join(','));
  if (filters.assigneeIds.length) params.set('assignee', filters.assigneeIds.join(','));
  if (filters.categoryIds.length) params.set('category', filters.categoryIds.join(','));
  if (filters.dueStatuses.length) params.set('due', filters.dueStatuses.join(','));
  if (filters.mineOnly) params.set('mine', '1');
  params.set('view', view);
  return `?${params.toString()}`;
}

export const DEFAULT_URL_STATE: UrlState = { filters: EMPTY_FILTERS, view: null };
