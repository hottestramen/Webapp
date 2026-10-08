import { create } from 'zustand';
import { applyTheme, resolveInitialTheme, writeStoredTheme } from '../lib/theme';
import type { Theme } from '../lib/theme';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const initial: Theme = typeof window === 'undefined' ? 'light' : resolveInitialTheme();
// 첫 화면이 그려지기 전에 적용해 라이트 → 다크로 번쩍이지 않게 한다
if (typeof document !== 'undefined') applyTheme(initial);

export const useThemeStore = create<ThemeState>((set) => ({
  theme: initial,
  setTheme: (theme) => {
    applyTheme(theme);
    writeStoredTheme(theme);
    set({ theme });
  },
}));
