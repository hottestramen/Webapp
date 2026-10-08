import { create } from 'zustand';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'error';
  action?: ToastAction;
}

interface ToastOptions {
  tone?: Toast['tone'];
  action?: ToastAction;
  /** 표시 시간(ms). 기본 4초(PRD §6.4) */
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  push: (message: string, options?: ToastOptions) => number;
  dismiss: (id: number) => void;
}

const DEFAULT_DURATION_MS = 4000;
let nextId = 1;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  push: (message, options = {}) => {
    const id = nextId++;
    const toast: Toast = { id, message, tone: options.tone ?? 'info', action: options.action };
    set((s) => ({ toasts: [...s.toasts, toast] }));
    setTimeout(() => get().dismiss(id), options.duration ?? DEFAULT_DURATION_MS);
    return id;
  },

  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  info: (message: string, options?: Omit<ToastOptions, 'tone'>) =>
    useToastStore.getState().push(message, options),
  error: (message: string) => useToastStore.getState().push(message, { tone: 'error' }),
};
