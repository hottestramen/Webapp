import { useEffect } from 'react';
import { isSupabaseConfigured } from '../lib/api';
import { startRealtime } from '../lib/realtime';
import { useCommentStore } from '../stores/commentStore';
import { useConnectionStore } from '../stores/connectionStore';
import { useLeaveStore } from '../stores/leaveStore';
import { useTaskStore } from '../stores/taskStore';

/** 실시간 구독을 시작하고, 받은 변경을 스토어에 병합한다(PRD §5.7). */
export function useRealtime(): void {
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    return startRealtime({
      onTask: (row) => useTaskStore.getState().applyRemoteTask(row),
      onComment: (row) => useCommentStore.getState().applyRemoteComment(row),
      onMember: (row) => useTaskStore.getState().applyRemoteMember(row),
      onCategory: (row) => useTaskStore.getState().applyRemoteCategory(row),
      onLeave: (row) => useLeaveStore.getState().applyRemoteLeave(row),
      onSoftDelete: (table, id) => {
        if (table === 'tasks') useTaskStore.getState().removeRemoteTask(id);
        else if (table === 'leaves') useLeaveStore.getState().removeRemoteLeave(id);
        else useCommentStore.getState().markRemoteDeleted(id);
      },
      onStatus: (status) => useConnectionStore.setState({ status }),
      reload: () => useTaskStore.getState().refresh(),
    });
  }, []);
}
