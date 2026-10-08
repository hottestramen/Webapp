import { ChartCard, DataTable } from './ChartCard';
import type { AssigneeLoad } from './metrics';

/** 담당자별 미완료 건수 가로 막대 차트(F-M-03). 막대마다 값 라벨을 함께 표시한다. */
export function AssigneeLoadChart({ rows }: { rows: AssigneeLoad[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));

  return (
    <ChartCard
      title="담당자별 미완료 건수"
      chart={
        rows.length === 0 ? (
          <p className="py-4 text-center text-sm text-text-muted">미완료 할일이 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((row) => (
              <li key={row.assigneeId ?? 'none'} className="flex items-center gap-3 text-sm">
                <span className="basis-1/3 truncate" title={row.name}>
                  {row.name}
                </span>
                <span className="h-4 flex-1 overflow-hidden rounded-pill bg-bg" aria-hidden="true">
                  <span
                    className={`block h-full rounded-pill ${
                      row.assigneeId === null ? 'bg-text-muted' : 'bg-chart'
                    }`}
                    style={{ width: `${(row.count / max) * 100}%` }}
                  />
                </span>
                <span className="w-6 shrink-0 text-right font-semibold">{row.count}건</span>
              </li>
            ))}
          </ul>
        )
      }
      table={
        <DataTable
          caption="담당자별 미완료 건수"
          headers={['담당자', '미완료 건수']}
          rows={rows.map((r) => [r.name, r.count])}
        />
      }
    />
  );
}
