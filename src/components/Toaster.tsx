import { useEffect, useRef } from 'react';
import { useToastStore } from '../stores/toastStore';

/**
 * 하단 중앙 토스트(PRD §6.4). 열려 있는 모달(<dialog>) 위에도 보이도록 popover(top layer)로 그린다.
 * 스크린리더 안내는 항상 존재하는 aria-live="polite" 영역이 맡는다(PRD §5.3).
 */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = popoverRef.current;
    if (!el || typeof el.showPopover !== 'function') return;
    // 토스트가 바뀔 때마다 다시 열어 모달보다 위에 쌓이게 한다.
    if (el.matches(':popover-open')) el.hidePopover();
    if (toasts.length > 0) el.showPopover();
  }, [toasts]);

  return (
    <>
      <div aria-live="polite" className="sr-only">
        {toasts.map((t) => (
          <p key={t.id}>{t.message}</p>
        ))}
      </div>

      <div
        ref={popoverRef}
        popover="manual"
        className="pointer-events-none inset-x-0 bottom-8 top-auto md:bottom-4 m-0 h-auto w-auto overflow-visible border-0 bg-transparent p-0"
      >
        <div className="flex flex-col items-center gap-2 px-4">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-center gap-3 rounded-md px-4 py-3 text-sm shadow-raised ${
                t.tone === 'error'
                  ? 'bg-badge-overdue-bg text-badge-overdue-text'
                  : 'bg-text text-surface'
              }`}
            >
              <span>{t.message}</span>
              {t.action && (
                <button
                  type="button"
                  onClick={() => {
                    t.action?.onClick();
                    dismiss(t.id);
                  }}
                  className="min-h-touch rounded-sm px-2 font-semibold underline"
                >
                  {t.action.label}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
