import { LEAVE_KIND_SHORT } from '../../lib/labels';
import { formatLeavePeriod, isTripKind, leaveLabel } from '../../lib/leaves';
import type { Leave } from '../../types';

interface LeaveChipProps {
  leave: Leave;
  memberName: string;
  tabbable?: boolean;
  onOpen: (leave: Leave) => void;
  /** 목록 팝오버처럼 넓은 곳에서는 기간을 함께 보여 준다 */
  showPeriod?: boolean;
}

/** 팀원 이름 + 휴가 종류. 누르면 수정·삭제 화면을 연다. 색(청록)과 글자 라벨을 함께 쓴다. */
export function LeaveChip({
  leave,
  memberName,
  tabbable = true,
  onOpen,
  showPeriod,
}: LeaveChipProps) {
  return (
    <button
      type="button"
      tabIndex={tabbable ? 0 : -1}
      aria-label={leaveLabel(leave, memberName)}
      onClick={(event) => {
        event.stopPropagation();
        onOpen(leave);
      }}
      className={`flex min-h-5 w-full min-w-0 items-center gap-1 rounded-sm px-1 text-left text-xs font-semibold ${
        isTripKind(leave.kind) ? 'bg-trip-bg text-trip-text' : 'bg-leave-bg text-leave-text'
      }`}
    >
      <span className="truncate">
        {memberName} {LEAVE_KIND_SHORT[leave.kind]}
      </span>
      {showPeriod && (
        <span className="ml-auto shrink-0 font-normal">{formatLeavePeriod(leave)}</span>
      )}
    </button>
  );
}
