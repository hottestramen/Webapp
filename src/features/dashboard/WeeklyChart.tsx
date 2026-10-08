import { formatWeekLabel } from '../../lib/format';
import { ChartCard, DataTable } from './ChartCard';
import type { WeeklyCompletion } from './metrics';

// SVG viewBox 안의 좌표 단위(화면 크기에 맞춰 비례해서 늘고 준다)
const STEP = 48;
const BAR_WIDTH = 28;
const TOP = 22;
const PLOT_HEIGHT = 110;
const LABEL_GAP = 16;
const HEIGHT = TOP + PLOT_HEIGHT + LABEL_GAP + 6;

/** 최근 8주 주간 완료 추이 막대 차트(F-M-06). 막대 위에 값 라벨, 아래에 주(월요일) 라벨을 쓴다. */
export function WeeklyChart({ data }: { data: WeeklyCompletion[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const width = data.length * STEP;
  const summary = data.map((d) => `${formatWeekLabel(d.weekStart)}주 ${d.count}건`).join(', ');

  return (
    <ChartCard
      title="주간 완료 추이 (최근 8주)"
      chart={
        <svg
          viewBox={`0 0 ${width} ${HEIGHT}`}
          role="img"
          aria-label={`최근 8주 주간 완료 건수. ${summary}`}
          className="h-auto w-full"
        >
          <line
            x1={0}
            x2={width}
            y1={TOP + PLOT_HEIGHT}
            y2={TOP + PLOT_HEIGHT}
            className="stroke-border"
          />
          {data.map((d, i) => {
            const barHeight = (d.count / max) * PLOT_HEIGHT;
            const x = i * STEP + (STEP - BAR_WIDTH) / 2;
            const y = TOP + PLOT_HEIGHT - barHeight;
            const center = i * STEP + STEP / 2;
            return (
              <g key={d.weekStart}>
                <rect
                  x={x}
                  y={y}
                  width={BAR_WIDTH}
                  height={barHeight}
                  rx={3}
                  className="fill-chart"
                />
                <text
                  x={center}
                  y={y - 5}
                  textAnchor="middle"
                  className="fill-text text-xs font-semibold"
                >
                  {d.count}
                </text>
                <text
                  x={center}
                  y={TOP + PLOT_HEIGHT + LABEL_GAP}
                  textAnchor="middle"
                  className="fill-text-muted text-xs"
                >
                  {formatWeekLabel(d.weekStart)}
                </text>
              </g>
            );
          })}
        </svg>
      }
      table={
        <DataTable
          caption="주간 완료 건수(주는 월요일 시작)"
          headers={['주 시작(월)', '완료 건수']}
          rows={data.map((d) => [formatWeekLabel(d.weekStart), d.count])}
        />
      }
    />
  );
}
