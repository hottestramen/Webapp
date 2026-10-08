import { useState } from 'react';
import { Button } from '../../components/Button';
import { listCategories, listComments, listLeaves, listMembers, listTasks } from '../../lib/api';
import { backupFileName, buildBackup } from '../../lib/exportData';
import { toast } from '../../stores/toastStore';
import { FormError, SettingsSection } from './SettingsSection';

/** 브라우저에서 파일로 저장한다(서버를 거치지 않는다). */
function downloadJson(fileName: string, json: string) {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** 전체 데이터 JSON 내보내기(PRD §5.4 백업). */
export function ExportSettings() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      // 화면에 보이는 값이 아니라 서버의 최신 값을 읽어 내보낸다.
      const [tasks, comments, members, categories, leaves] = await Promise.all([
        listTasks(),
        listComments(),
        listMembers(),
        listCategories(),
        listLeaves(),
      ]);
      const now = new Date();
      const backup = buildBackup({ tasks, comments, members, categories, leaves }, now);
      downloadJson(backupFileName(now), JSON.stringify(backup, null, 2));
      toast.info(
        `할일 ${tasks.length}건, 댓글 ${comments.length}건, 휴가 ${leaves.length}건을 내보냈습니다.`,
      );
    } catch {
      setError('내보내지 못했습니다. 네트워크를 확인하고 다시 시도하세요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsSection
      title="데이터 내보내기"
      description="할일·댓글·팀원·카테고리·휴가 전체를 JSON 파일 하나로 내려받습니다. 삭제 처리된 할일·댓글은 포함되지 않습니다(복구는 관리자가 콘솔에서 합니다). Supabase 자동 백업도 함께 켜 두세요."
    >
      <div>
        <Button variant="primary" disabled={busy} onClick={() => void handleExport()}>
          {busy ? '내보내는 중…' : 'JSON 내보내기'}
        </Button>
      </div>
      <FormError message={error} />
    </SettingsSection>
  );
}
