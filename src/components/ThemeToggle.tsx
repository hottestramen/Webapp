import { useThemeStore } from '../stores/themeStore';

/** 다크 모드 토글 스위치. 켜면 다크, 끄면 라이트. 선택은 이 브라우저에 저장된다. */
export function ThemeToggle() {
  const dark = useThemeStore((s) => s.theme === 'dark');
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="다크 모드"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      className="inline-flex min-h-touch min-w-touch items-center justify-center gap-2 rounded-md px-2 text-text"
    >
      {/* 달 아이콘 */}
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
      >
        <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />
      </svg>
      {/* 스위치: 꺼짐은 왼쪽, 켜짐은 오른쪽(위치와 색 모두로 상태를 알린다) */}
      <span
        aria-hidden="true"
        className={`flex h-5 w-7 items-center rounded-pill border border-text-muted px-1 ${
          dark ? 'justify-end bg-primary-strong' : 'justify-start bg-transparent'
        }`}
      >
        <span className={`h-3 w-3 rounded-pill ${dark ? 'bg-on-brand' : 'bg-text-muted'}`} />
      </span>
    </button>
  );
}
