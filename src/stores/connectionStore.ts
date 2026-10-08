import { create } from 'zustand';
import type { ConnectionStatus } from '../lib/realtime';

/** 실시간 연결 상태. 오프라인이면 헤더에 "오프라인 — 재연결 중"을 보여 준다(PRD §5.7). */
export const useConnectionStore = create<{ status: ConnectionStatus }>(() => ({
  status: 'connecting',
}));
