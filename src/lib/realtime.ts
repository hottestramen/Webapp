import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Category, Comment, Leave, Member, Task } from '../types';

export type ConnectionStatus = 'connecting' | 'online' | 'offline';

export interface RealtimeHandlers {
  onTask: (row: Task) => void;
  onComment: (row: Comment) => void;
  onMember: (row: Member) => void;
  onCategory: (row: Category) => void;
  onLeave: (row: Leave) => void;
  /** 소프트 삭제 알림(004_realtime.sql 의 브로드캐스트) */
  onSoftDelete: (table: 'tasks' | 'comments' | 'leaves', id: string, by: string | null) => void;
  onStatus: (status: ConnectionStatus) => void;
  /** 전체 다시 불러오기. 성공하면 true */
  reload: () => Promise<boolean>;
}

export interface RealtimeOptions {
  /** 연결이 끊겼을 때의 폴링 주기(ms). 기본 30초(PRD §5.7) */
  pollMs?: number;
}

const POLL_MS = 30_000;
const CHANNEL = 'team-calendar';

/**
 * Supabase Realtime(postgres_changes)으로 변경을 구독한다(PRD §5.7).
 * - 끊기면 30초 폴링으로 바꾸고 offline 을 알린다. 다시 연결되면 전체를 한 번 불러오고 폴링을 멈춘다.
 * - 탭이 다시 보이면 전체를 다시 불러온다.
 * 돌려주는 함수를 호출하면 구독을 모두 정리한다.
 */
export function startRealtime(
  handlers: RealtimeHandlers,
  options: RealtimeOptions = {},
): () => void {
  const pollMs = options.pollMs ?? POLL_MS;
  let stopped = false;
  let offline = false;
  let pollTimer: ReturnType<typeof setInterval> | undefined;

  const stopPolling = () => {
    clearInterval(pollTimer);
    pollTimer = undefined;
  };

  const goOffline = () => {
    if (stopped) return;
    if (!offline) {
      offline = true;
      handlers.onStatus('offline');
    }
    pollTimer ??= setInterval(() => void handlers.reload(), pollMs);
  };

  const goOnline = () => {
    if (stopped) return;
    stopPolling();
    const wasOffline = offline;
    offline = false;
    handlers.onStatus('online');
    // 끊겨 있는 동안 놓친 변경을 한 번에 따라잡는다
    if (wasOffline) void handlers.reload();
  };

  const channel = supabase.channel(CHANNEL);

  const listen = <T>(table: string, apply: (row: T) => void) =>
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
        // DELETE 는 쓰지 않는다(삭제는 deleted_at 으로만 한다)
        if (payload.eventType === 'DELETE') return;
        apply(payload.new as T);
      },
    );

  listen<Task>('tasks', handlers.onTask);
  listen<Comment>('comments', handlers.onComment);
  listen<Member>('members', handlers.onMember);
  listen<Category>('categories', handlers.onCategory);
  listen<Leave>('leaves', handlers.onLeave);

  channel.on('broadcast', { event: 'soft-delete' }, ({ payload }) => {
    const { table, id, updated_by } = payload as {
      table: string;
      id: string;
      updated_by: string | null;
    };
    if (table === 'tasks' || table === 'comments' || table === 'leaves')
      handlers.onSoftDelete(table, id, updated_by ?? null);
  });

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') goOnline();
    else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED')
      goOffline();
  });

  const onVisible = () => {
    if (document.visibilityState === 'visible') void handlers.reload();
  };
  const onBrowserOffline = () => goOffline();

  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('offline', onBrowserOffline);

  return () => {
    stopped = true;
    stopPolling();
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('offline', onBrowserOffline);
    void supabase.removeChannel(channel);
  };
}
