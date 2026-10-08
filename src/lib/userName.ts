export const NAME_MIN = 1;
export const NAME_MAX = 20;

const STORAGE_KEY = 'team-calendar:user-name';

/** 앞뒤 공백을 제거한 이름이 1~20자이면 정리된 이름을, 아니면 오류 메시지를 돌려준다. */
export function validateName(
  raw: string,
): { ok: true; name: string } | { ok: false; error: string } {
  const name = raw.trim();
  if (name.length < NAME_MIN) return { ok: false, error: '이름을 입력하세요.' };
  if (name.length > NAME_MAX)
    return { ok: false, error: `이름은 ${NAME_MAX}자 이하로 입력하세요.` };
  return { ok: true, name };
}

// localStorage 는 시크릿 모드·차단 설정에서 던질 수 있으므로 항상 try/catch 로 감싼다.
export function readStoredName(): string | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)?.trim();
    return value ? value : null;
  } catch {
    return null;
  }
}

export function writeStoredName(name: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {
    // 저장 실패 시 이번 세션에서만 이름이 유지된다.
  }
}
