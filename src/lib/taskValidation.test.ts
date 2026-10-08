import { describe, expect, it } from 'vitest';
import { validateComment, validateTaskForm } from './taskValidation';

const ok = { title: '보고서', description: '', assigneeName: '' };

describe('validateTaskForm', () => {
  it('정상 값은 오류 없음', () => {
    expect(validateTaskForm(ok)).toEqual({});
  });

  it('제목은 공백 제거 후 1~100자', () => {
    expect(validateTaskForm({ ...ok, title: '   ' }).title).toBeDefined();
    expect(validateTaskForm({ ...ok, title: 'a'.repeat(100) }).title).toBeUndefined();
    expect(validateTaskForm({ ...ok, title: 'a'.repeat(101) }).title).toBeDefined();
    expect(validateTaskForm({ ...ok, title: `  ${'a'.repeat(100)}  ` }).title).toBeUndefined();
  });

  it('설명은 2,000자 이하', () => {
    expect(validateTaskForm({ ...ok, description: 'a'.repeat(2000) }).description).toBeUndefined();
    expect(validateTaskForm({ ...ok, description: 'a'.repeat(2001) }).description).toBeDefined();
  });

  it('담당자 이름은 20자 이하', () => {
    expect(validateTaskForm({ ...ok, assigneeName: 'a'.repeat(21) }).assigneeName).toBeDefined();
  });
});

describe('validateComment', () => {
  it('공백만이면 오류, 1,000자까지 허용', () => {
    expect(validateComment('  ')).not.toBeNull();
    expect(validateComment('a'.repeat(1000))).toBeNull();
    expect(validateComment('a'.repeat(1001))).not.toBeNull();
  });
});
