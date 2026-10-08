import { VIEWS } from './views';
import type { ViewId } from './views';

interface ViewTabsProps {
  active: ViewId;
  onChange: (view: ViewId) => void;
}

/**
 * 뷰 전환 탭(PRD §5.1). 같은 요소를 CSS 로만 바꿔 쓴다.
 * 모바일(<md): 화면 하단 고정 탭바 / 태블릿 이상: 상단 알약형 탭.
 */
export function ViewTabs({ active, onChange }: ViewTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="보기 전환"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border bg-surface shadow-raised md:static md:z-auto md:flex md:gap-2 md:overflow-x-auto md:border-0 md:bg-transparent md:shadow-none"
    >
      {VIEWS.map((view) => {
        const selected = view.id === active;
        return (
          <button
            key={view.id}
            id={`tab-${view.id}`}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls={`panel-${view.id}`}
            onClick={() => onChange(view.id)}
            className={`min-h-touch whitespace-nowrap border-t-stripe px-2 text-sm font-semibold transition duration-fast ease-brand md:rounded-pill md:border md:px-4 ${
              selected
                ? 'border-t-primary-strong text-primary-text md:border-transparent md:bg-brand md:text-on-brand'
                : 'border-t-transparent text-text-muted md:border-border md:bg-surface'
            }`}
          >
            {view.label}
          </button>
        );
      })}
    </div>
  );
}
