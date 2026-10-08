import type {
  AvatarColorKey,
  CategoryColorKey,
  LeaveKind,
  TaskPriority,
  TaskStatus,
} from '../types';

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: '할 일',
  'in-progress': '진행 중',
  done: '완료',
};

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  high: '높음',
  medium: '보통',
  low: '낮음',
};

// Tailwind 가 클래스를 찾을 수 있도록 전체 클래스명을 문자열로 적어 둔다. 색은 토큰(tokens.css)에서 온다.
export const STATUS_BADGE_CLASS: Record<TaskStatus, string> = {
  todo: 'bg-badge-todo-bg text-badge-todo-text',
  'in-progress': 'bg-badge-progress-bg text-badge-progress-text',
  done: 'bg-badge-done-bg text-badge-done-text',
};

export const DUE_STATUS_LABEL = {
  soon: '마감 임박(D-3 이내)',
  overdue: '지연',
} as const;

export const PRIORITY_BADGE_CLASS: Record<TaskPriority, string> = {
  high: 'bg-badge-high-bg text-badge-high-text',
  medium: 'bg-badge-medium-bg text-badge-medium-text',
  low: 'bg-badge-low-bg text-badge-low-text',
};

export const AVATAR_CLASS: Record<AvatarColorKey, string> = {
  'avatar-1': 'bg-avatar-1',
  'avatar-2': 'bg-avatar-2',
  'avatar-3': 'bg-avatar-3',
  'avatar-4': 'bg-avatar-4',
  'avatar-5': 'bg-avatar-5',
  'avatar-6': 'bg-avatar-6',
  'avatar-7': 'bg-avatar-7',
  'avatar-8': 'bg-avatar-8',
};

/** 캘린더의 우선순위 색 점(토큰). 점만으로 구분하지 않도록 접근성 이름에 우선순위를 함께 넣는다. */
export const PRIORITY_DOT_CLASS: Record<TaskPriority, string> = {
  high: 'bg-badge-high-text',
  medium: 'bg-badge-medium-text',
  low: 'bg-badge-low-text',
};

export const CATEGORY_BG_CLASS: Record<CategoryColorKey, string> = {
  'cat-1': 'bg-cat-1',
  'cat-2': 'bg-cat-2',
  'cat-3': 'bg-cat-3',
  'cat-4': 'bg-cat-4',
  'cat-5': 'bg-cat-5',
  'cat-6': 'bg-cat-6',
  'cat-7': 'bg-cat-7',
  'cat-8': 'bg-cat-8',
};

export const AVATAR_KEYS = Object.keys(AVATAR_CLASS) as AvatarColorKey[];
export const CATEGORY_KEYS = Object.keys(CATEGORY_BG_CLASS) as CategoryColorKey[];

export const LEAVE_KIND_LABEL: Record<LeaveKind, string> = {
  annual: '연차',
  'half-am': '오전 반차',
  'half-pm': '오후 반차',
  sick: '병가',
  other: '기타',
  trip: '출장',
};

/** 캘린더 칩처럼 좁은 곳에서 쓰는 짧은 이름 */
export const LEAVE_KIND_SHORT: Record<LeaveKind, string> = {
  annual: '연차',
  'half-am': '오전반차',
  'half-pm': '오후반차',
  sick: '병가',
  other: '휴가',
  trip: '출장',
};
