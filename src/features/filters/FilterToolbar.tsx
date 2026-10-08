import { useId, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { pickFilters, useFilterStore } from '../../stores/filterStore';
import { countActiveFilters } from './applyFilters';
import { FilterPanel } from './FilterPanel';

/**
 * 데스크탑(lg) 아래에서 보이는 필터 진입점(PRD §5.1).
 * 태블릿(md): 접이식 패널 / 모바일: 바텀시트. 데스크탑은 App 의 좌측 사이드바를 쓴다.
 * 화면 크기별 노출은 CSS(md:, lg:)로만 나눈다.
 */
export function FilterToolbar() {
  const filters = useFilterStore(useShallow(pickFilters));
  const setMineOnly = useFilterStore((s) => s.setMineOnly);
  const [panelOpen, setPanelOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const panelId = useId();
  const sheetTitleId = useId();
  const count = countActiveFilters(filters);
  const label = count > 0 ? `필터 (${count})` : '필터';

  return (
    <div className="flex flex-col gap-3 lg:hidden">
      <div className="flex flex-wrap items-center gap-2">
        {/* 모바일: 바텀시트 */}
        <Button onClick={() => setSheetOpen(true)} className="md:hidden" aria-haspopup="dialog">
          {label}
        </Button>
        {/* 태블릿: 접이식 패널 */}
        <Button
          onClick={() => setPanelOpen((v) => !v)}
          aria-expanded={panelOpen}
          aria-controls={panelId}
          className="hidden md:inline-flex"
        >
          {label}
        </Button>

        <Button
          onClick={() => setMineOnly(!filters.mineOnly)}
          aria-pressed={filters.mineOnly}
          className={filters.mineOnly ? 'border-primary text-primary-text' : ''}
        >
          내 할일만
        </Button>
      </div>

      {panelOpen && (
        <div
          id={panelId}
          className="hidden rounded-md border border-border bg-surface p-4 md:block"
        >
          <FilterPanel />
        </div>
      )}

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="필터"
        titleId={sheetTitleId}
      >
        {sheetOpen && <FilterPanel />}
      </BottomSheet>
    </div>
  );
}
