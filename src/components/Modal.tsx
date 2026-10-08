import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** 접근 가능한 이름으로 쓸 요소의 id (모달 안의 제목) */
  labelledBy: string;
  size?: 'md' | 'lg';
  /** 와이드(≥1440px) 화면에서 중앙 모달 대신 우측 패널로 연다(PRD §5.1) */
  panel?: boolean;
  children: ReactNode;
}

/**
 * 모바일은 전체 화면 시트, 데스크탑(md 이상)은 중앙 모달(PRD §6.4).
 * 네이티브 <dialog>.showModal() 이 포커스 가두기·Esc 닫기·닫을 때 원래 요소로 포커스 복귀를 처리한다(PRD §5.3).
 */
export function Modal({
  open,
  onClose,
  labelledBy,
  size = 'lg',
  panel = false,
  children,
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const width = size === 'lg' ? 'md:max-w-modal-lg' : 'md:max-w-modal';
  const panelClass = panel
    ? 'wide:m-0 wide:ml-auto wide:h-full wide:max-h-full wide:rounded-none wide:rounded-l-lg'
    : '';

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // 바깥(backdrop) 클릭으로 닫기
        if (event.target === ref.current) onClose();
      }}
      className={`m-auto h-full max-h-full w-full max-w-full overflow-y-auto rounded-none border-0 bg-surface p-0 text-text shadow-raised backdrop:bg-overlay md:h-auto md:max-h-screen md:rounded-lg ${width} ${panelClass}`}
    >
      {open && children}
    </dialog>
  );
}
