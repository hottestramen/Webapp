import { useId } from 'react';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import type { Leave } from '../../types';
import { LeaveChip } from './LeaveChip';

interface LeavesDialogProps {
  open: boolean;
  title: string;
  leaves: readonly Leave[];
  memberName: (id: string) => string;
  onClose: () => void;
  onOpenLeave: (leave: Leave) => void;
}

/** 한 날짜의 휴가자 전체 목록("휴가 +N명" 더보기) */
export function LeavesDialog({
  open,
  title,
  leaves,
  memberName,
  onClose,
  onOpenLeave,
}: LeavesDialogProps) {
  const titleId = useId();

  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId} size="md">
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-xl font-bold">
            {title}
          </h2>
          <Button onClick={onClose}>닫기</Button>
        </div>
        <ul className="flex flex-col gap-2">
          {leaves.map((leave) => (
            <li key={leave.id}>
              <LeaveChip
                leave={leave}
                memberName={memberName(leave.member_id)}
                onOpen={onOpenLeave}
                showPeriod
              />
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
