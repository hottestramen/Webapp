import type { Config } from 'tailwindcss';

/**
 * 모든 값은 src/styles/tokens.css 의 CSS 변수를 참조한다.
 * 기본 팔레트·간격은 쓰지 않도록 theme 를 덮어쓴다(extend 아님).
 */
const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

const badge = (key: string) => ({
  bg: `var(--badge-${key}-bg)`,
  text: `var(--badge-${key}-text)`,
});

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    // PRD §5.1 브레이크포인트: 모바일 < md(768) / 태블릿 md~lg / 데스크탑 lg(1024)~ / 와이드 wide(1440)~
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      wide: '1440px',
    },
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      primary: {
        DEFAULT: 'var(--color-primary)',
        strong: 'var(--color-primary-strong)',
        text: 'var(--color-primary-text)',
      },
      chart: 'var(--color-chart)',
      leave: { bg: 'var(--leave-bg)', text: 'var(--leave-text)' },
      trip: { bg: 'var(--trip-bg)', text: 'var(--trip-text)' },
      'on-brand': 'var(--color-on-brand)',
      bg: 'var(--color-bg)',
      surface: 'var(--color-surface)',
      'header-bg': 'var(--color-header-bg)',
      text: { DEFAULT: 'var(--color-text)', muted: 'var(--color-text-muted)' },
      border: 'var(--color-border)',
      focus: 'var(--color-focus)',
      overlay: 'var(--color-overlay)',
      danger: 'var(--color-danger)',
      holiday: 'var(--color-holiday)',
      saturday: 'var(--color-saturday)',
      'avatar-text': 'var(--avatar-text)',
      avatar: Object.fromEntries(range(8).map((i) => [i, `var(--avatar-${i})`])),
      cat: Object.fromEntries(range(8).map((i) => [i, `var(--cat-${i})`])),
      badge: {
        todo: badge('todo'),
        progress: badge('progress'),
        done: badge('done'),
        high: badge('high'),
        medium: badge('medium'),
        low: badge('low'),
        'due-soon': badge('due-soon'),
        overdue: badge('overdue'),
      },
    },
    spacing: {
      0: '0',
      ...Object.fromEntries(range(8).map((i) => [i, `var(--space-${i})`])),
      touch: 'var(--size-touch)',
      header: 'var(--size-header)',
      stripe: 'var(--priority-high-stripe-width)',
      sidebar: 'var(--size-sidebar)',
      kanban: 'var(--size-kanban-col)',
      cell: 'var(--size-cell-min)',
    },
    borderRadius: {
      none: '0',
      sm: 'var(--radius-sm)',
      md: 'var(--radius-md)',
      lg: 'var(--radius-lg)',
      pill: 'var(--radius-pill)',
    },
    borderWidth: {
      DEFAULT: 'var(--border-width)',
      0: '0',
      stripe: 'var(--priority-high-stripe-width)',
    },
    boxShadow: {
      none: 'none',
      card: 'var(--shadow-card)',
      raised: 'var(--shadow-raised)',
    },
    fontFamily: { sans: 'var(--font-sans)' },
    fontSize: {
      xs: 'var(--text-xs)',
      sm: 'var(--text-sm)',
      base: 'var(--text-base)',
      lg: 'var(--text-lg)',
      xl: 'var(--text-xl)',
      '2xl': 'var(--text-2xl)',
    },
    maxWidth: {
      full: '100%',
      modal: 'var(--size-modal)',
      'modal-lg': 'var(--size-modal-lg)',
      content: 'var(--size-content-max)',
    },
    transitionDuration: {
      DEFAULT: 'var(--motion-base)',
      fast: 'var(--motion-fast)',
      base: 'var(--motion-base)',
    },
    transitionTimingFunction: {
      DEFAULT: 'var(--motion-ease)',
      brand: 'var(--motion-ease)',
    },
    backgroundImage: { brand: 'var(--gradient-brand)' },
    outlineWidth: { DEFAULT: 'var(--focus-ring-width)' },
    extend: {
      keyframes: {
        flash: {
          '0%': { boxShadow: 'var(--shadow-raised)' },
          '100%': { boxShadow: 'var(--shadow-card)' },
        },
      },
      animation: { flash: 'flash 1500ms var(--motion-ease)' },
      translate: { lift: 'var(--card-lift)' },
    },
  },
  plugins: [],
};

export default config;
