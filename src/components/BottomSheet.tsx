import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Button } from './Button';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  titleId: string;
  children: ReactNode;
}

/** 모바일 바텀시트(PRD §5.1). 네이티브 <dialog> 라서 포커스 가두기·Esc·포커스 복귀를 브라우저가 처리한다. */
export function BottomSheet({ open, onClose, title, titleId, children }: BottomSheetProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className="m-0 mt-auto max-h-full w-full max-w-full overflow-y-auto rounded-b-none rounded-t-lg border-0 bg-surface p-0 text-text shadow-raised backdrop:bg-overlay"
    >
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-xl font-bold">
            {title}
          </h2>
          <Button onClick={onClose}>닫기</Button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
