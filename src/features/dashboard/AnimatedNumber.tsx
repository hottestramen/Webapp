import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../../lib/useReducedMotion';

const DURATION_MS = 600;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

interface AnimatedNumberProps {
  value: number;
  decimals?: number;
}

/**
 * 값이 바뀌면 부드럽게 세어 올라가는 숫자. 동작 줄이기 설정이면 애니메이션 없이 바로 보여 준다.
 * 스크린리더에는 애니메이션 중간값 대신 최종 값만 읽히게 한다.
 */
export function AnimatedNumber({ value, decimals = 0 }: AnimatedNumberProps) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    if (reduced) return;
    const from = latest.current;
    const startedAt = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt) / DURATION_MS);
      latest.current = from + (value - from) * easeOut(t);
      setShown(latest.current);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);

  const display = reduced ? value : shown;
  return (
    <>
      <span aria-hidden="true">{display.toFixed(decimals)}</span>
      <span className="sr-only">{value.toFixed(decimals)}</span>
    </>
  );
}
