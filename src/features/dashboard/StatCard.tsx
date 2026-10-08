import { AnimatedNumber } from './AnimatedNumber';

type Tone = 'default' | 'brand' | 'soon' | 'overdue';

const TONE_CLASS: Record<Tone, string> = {
  default: 'border-border bg-surface text-text',
  // 강조 카드: 브랜드 그라디언트
  brand: 'border-transparent bg-brand text-on-brand',
  soon: 'border-transparent bg-badge-due-soon-bg text-badge-due-soon-text',
  overdue: 'border-transparent bg-badge-overdue-bg text-badge-overdue-text',
};

interface StatCardProps {
  label: string;
  /** null 이면 "—" (예: 전체 0건일 때의 완료율) */
  value: number | null;
  decimals?: number;
  suffix?: string;
  tone?: Tone;
  /** 0~100. 주면 진행 막대를 그린다 */
  progress?: number | null;
  /** 주면 카드가 버튼이 되어, 누르면 해당 조건의 목록으로 이동한다 */
  onClick?: () => void;
  /** 눌렀을 때 일어나는 일(스크린리더용). 기본은 "해당 항목 목록 보기" */
  hint?: string;
}

export function StatCard({
  label,
  value,
  decimals = 0,
  suffix = '',
  tone = 'default',
  progress,
  onClick,
  hint = '해당 항목 목록 보기',
}: StatCardProps) {
  const className = `flex min-h-touch flex-col gap-2 rounded-md border p-4 text-left shadow-card ${TONE_CLASS[tone]} ${
    onClick ? 'cursor-pointer transition duration-fast ease-brand hover:-translate-y-lift' : ''
  }`;

  const body = (
    <>
      <span className="text-sm font-semibold">{label}</span>
      <span className="text-2xl font-bold">
        {value === null ? (
          '—'
        ) : (
          <>
            <AnimatedNumber value={value} decimals={decimals} />
            {suffix}
          </>
        )}
      </span>
      {progress !== undefined && (
        <span className="relative block h-2 overflow-hidden rounded-pill" aria-hidden="true">
          <span className="absolute inset-0 bg-current opacity-30" />
          <span
            className="absolute inset-y-0 left-0 rounded-pill bg-current transition-all duration-base ease-brand"
            style={{ width: `${progress ?? 0}%` }}
          />
        </span>
      )}
    </>
  );

  const valueText = value === null ? '없음' : `${value.toFixed(decimals)}${suffix}`;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={`${label} ${valueText}. 눌러서 ${hint}`}
        className={className}
      >
        {body}
      </button>
    );
  }
  return (
    <div role="group" aria-label={`${label} ${valueText}`} className={className}>
      {body}
    </div>
  );
}
