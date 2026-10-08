import { useId } from 'react';
import { Modal } from '../../components/Modal';
import { TaskForm } from './TaskForm';

interface TaskFormModalProps {
  open: boolean;
  onClose: () => void;
  /** 등록 후 호출(저장된 할일의 id) */
  onCreated?: (id: string) => void;
  defaultDueDate?: string;
}

/** 새 할일 등록 모달. 수정은 상세 화면에서 같은 TaskForm 을 쓴다. */
export function TaskFormModal({ open, onClose, onCreated, defaultDueDate }: TaskFormModalProps) {
  const titleId = useId();

  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId}>
      <div className="flex flex-col gap-4 p-5">
        <h2 id={titleId} className="text-xl font-bold">
          새 할일
        </h2>
        <TaskForm
          defaultDueDate={defaultDueDate}
          submitLabel="등록"
          onCancel={onClose}
          onDone={(saved) => {
            onCreated?.(saved.id);
            onClose();
          }}
        />
      </div>
    </Modal>
  );
}
