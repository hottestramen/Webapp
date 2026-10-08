// PRD §4.8 제약. 같은 규칙을 DB CHECK 제약으로도 건다(001_init.sql).
export const TITLE_MAX = 100;
export const DESCRIPTION_MAX = 2000;
export const ASSIGNEE_NAME_MAX = 20;
export const COMMENT_MAX = 1000;

export interface TaskFormValues {
  title: string;
  description: string;
  assigneeName: string;
}

export type TaskFormErrors = Partial<Record<keyof TaskFormValues, string>>;

export function validateTaskForm(values: TaskFormValues): TaskFormErrors {
  const errors: TaskFormErrors = {};

  const title = values.title.trim();
  if (title.length < 1) errors.title = '제목을 입력하세요.';
  else if (title.length > TITLE_MAX) errors.title = `제목은 ${TITLE_MAX}자 이하로 입력하세요.`;

  if (values.description.length > DESCRIPTION_MAX) {
    errors.description = `설명은 ${DESCRIPTION_MAX.toLocaleString()}자 이하로 입력하세요.`;
  }

  if (values.assigneeName.trim().length > ASSIGNEE_NAME_MAX) {
    errors.assigneeName = `이름은 ${ASSIGNEE_NAME_MAX}자 이하로 입력하세요.`;
  }

  return errors;
}

/** 댓글: 앞뒤 공백 제거 후 1~1,000자. 오류가 없으면 null. */
export function validateComment(raw: string): string | null {
  const content = raw.trim();
  if (content.length < 1) return '댓글 내용을 입력하세요.';
  if (content.length > COMMENT_MAX)
    return `댓글은 ${COMMENT_MAX.toLocaleString()}자 이하로 입력하세요.`;
  return null;
}
