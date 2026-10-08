export type TaskStatus = 'todo' | 'in-progress' | 'done';
export type TaskPriority = 'high' | 'medium' | 'low';

export const TASK_STATUSES: readonly TaskStatus[] = ['todo', 'in-progress', 'done'];
export const TASK_PRIORITIES: readonly TaskPriority[] = ['high', 'medium', 'low'];

/** 디자인 토큰 색 키: members.color 는 avatar-1 ~ avatar-8 */
export type AvatarColorKey = `avatar-${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;
/** categories.color 는 cat-1 ~ cat-8 */
export type CategoryColorKey = `cat-${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: string | null;
  category_id: string | null;
  /** 'YYYY-MM-DD' (시간 없음) */
  due_date: string | null;
  completed_at: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Comment {
  id: string;
  task_id: string;
  author_name: string;
  content: string;
  created_at: string;
  deleted_at: string | null;
}

export interface Member {
  id: string;
  name: string;
  color: AvatarColorKey;
  active: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  color: CategoryColorKey;
  sort_order: number;
  active: boolean;
}

export interface Holiday {
  /** 'YYYY-MM-DD' */
  date: string;
  name: string;
}

type TaskEditable = Pick<
  Task,
  | 'title'
  | 'description'
  | 'status'
  | 'priority'
  | 'assignee_id'
  | 'category_id'
  | 'due_date'
  | 'completed_at'
>;

/** 등록 시 클라이언트가 보내는 값. 나머지는 DB 기본값을 따른다. */
export type TaskInsert = Pick<Task, 'title' | 'created_by' | 'updated_by'> &
  Partial<TaskEditable> & {
    /** 클라이언트가 미리 정한 id(실시간으로 되돌아온 내 변경과 합치기 위해) */
    id?: string;
  };

/** 수정 값. updated_by 는 필수다(F-U-03). */
export type TaskUpdate = Partial<TaskEditable> & Pick<Task, 'updated_by'>;

export type CommentInsert = Pick<Comment, 'task_id' | 'author_name' | 'content'> & { id?: string };
export type MemberInsert = Pick<Member, 'name'> & Partial<Pick<Member, 'color' | 'active'>>;
export type MemberUpdate = Partial<Pick<Member, 'name' | 'color' | 'active'>>;
export type CategoryInsert = Pick<Category, 'name' | 'color'> &
  Partial<Pick<Category, 'sort_order' | 'active'>>;
export type CategoryUpdate = Partial<Pick<Category, 'name' | 'color' | 'sort_order' | 'active'>>;

export type LeaveKind = 'annual' | 'half-am' | 'half-pm' | 'sick' | 'other' | 'trip';
export const LEAVE_KINDS: readonly LeaveKind[] = [
  'annual',
  'half-am',
  'half-pm',
  'sick',
  'other',
  'trip',
];

/** 팀원 휴가·출장(kind 'trip'). start_date~end_date(포함)에 쉰다. 반차는 하루(start_date = end_date). */
export interface Leave {
  id: string;
  member_id: string;
  kind: LeaveKind;
  /** 'YYYY-MM-DD' */
  start_date: string;
  end_date: string;
  note: string | null;
  created_by: string;
  created_at: string;
  deleted_at: string | null;
}

export type LeaveInsert = Pick<
  Leave,
  'member_id' | 'kind' | 'start_date' | 'end_date' | 'created_by'
> &
  Partial<Pick<Leave, 'note'>> & { id?: string };
export type LeaveUpdate = Partial<
  Pick<Leave, 'member_id' | 'kind' | 'start_date' | 'end_date' | 'note'>
>;
