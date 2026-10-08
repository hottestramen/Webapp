import { create } from 'zustand';
import { todayInSeoul } from '../lib/dueStatus';

/** 앱 전역의 "오늘"(Asia/Seoul 날짜). 자정이 지나면 갱신되어 배지가 다시 계산된다(F-D-04). */
export const useTodayStore = create<{ today: string }>(() => ({ today: todayInSeoul() }));

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 다음 서울 자정까지 남은 밀리초 */
export function msUntilSeoulMidnight(now: number = Date.now()): number {
  const seoulNow = now + KST_OFFSET_MS;
  return (Math.floor(seoulNow / DAY_MS) + 1) * DAY_MS - seoulNow;
}

function refresh() {
  const next = todayInSeoul();
  if (next !== useTodayStore.getState().today) useTodayStore.setState({ today: next });
}

/** 자정 타이머와 탭 복귀 시 갱신을 시작한다. 정리 함수를 돌려준다. */
export function startTodayTimer(): () => void {
  let timer: ReturnType<typeof setTimeout>;

  const schedule = () => {
    // 자정 직후에 확실히 넘어가도록 1초 여유를 둔다.
    timer = setTimeout(() => {
      refresh();
      schedule();
    }, msUntilSeoulMidnight() + 1000);
  };
  const onVisible = () => {
    if (document.visibilityState === 'visible') refresh();
  };

  refresh();
  schedule();
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
