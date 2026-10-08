import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '../../components/Button';

interface ChartCardProps {
  title: string;
  /** 차트(막대에 값 라벨 포함) */
  chart: ReactNode;
  /** 같은 데이터를 보여 주는 표. "표로 보기" 토글로 차트와 바꿔 본다 */
  table: ReactNode;
}

/** 차트마다 텍스트 대안을 제공한다: 막대의 값 라벨 + "표로 보기" 토글(PRD §5.3 색 의존 금지). */
export function ChartCard({ title, chart, table }: ChartCardProps) {
  const [asTable, setAsTable] = useState(false);
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4 shadow-card"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 id={headingId} className="text-lg font-semibold">
          {title}
        </h3>
        <Button onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
          {asTable ? '차트로 보기' : '표로 보기'}
        </Button>
      </div>
      {asTable ? table : chart}
    </section>
  );
}

export function DataTable({
  caption,
  headers,
  rows,
}: {
  caption: string;
  headers: [string, string];
  rows: [string, number][];
}) {
  return (
    <table className="w-full border-collapse text-left text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b border-border">
          <th scope="col" className="py-2 pr-3 font-semibold">
            {headers[0]}
          </th>
          <th scope="col" className="py-2 font-semibold">
            {headers[1]}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([name, value]) => (
          <tr key={name} className="border-b border-border last:border-b-0">
            <th scope="row" className="py-2 pr-3 font-normal">
              {name}
            </th>
            <td className="py-2">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
