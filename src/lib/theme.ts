export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'team-calendar:theme';

// localStorage 는 차단될 수 있으므로 항상 try/catch 로 감싼다.
function readStoredTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

export function writeStoredTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // 저장하지 못해도 이번 세션에는 적용된다
  }
}

/** 저장된 선택이 있으면 그 값, 없으면 OS 의 다크 모드 설정을 따른다 */
export function resolveInitialTheme(): Theme {
  const stored = readStoredTheme();
  if (stored) return stored;
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/** <html data-theme="..."> 로 토큰(tokens.css)의 색을 바꾼다 */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}
