import { useEffect, useRef } from 'react';
import { Button } from '../../components/Button';
import { CategoriesSettings } from './CategoriesSettings';
import { ExportSettings } from './ExportSettings';
import { GuideSettings } from './GuideSettings';
import { HolidaysSettings } from './HolidaysSettings';
import { MembersSettings } from './MembersSettings';
import { TrashSettings } from './TrashSettings';

/** 설정 화면(PRD §7): 팀원·카테고리·임시공휴일·데이터 내보내기·사용 안내 */
export function SettingsPage({ onClose }: { onClose: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);

  // 화면이 바뀐 것을 스크린리더가 알 수 있게 제목으로 포커스를 옮긴다.
  useEffect(() => heading.current?.focus(), []);

  return (
    <main className="mx-auto flex max-w-modal-lg flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 ref={heading} tabIndex={-1} className="text-2xl font-bold">
          설정
        </h2>
        <Button onClick={onClose}>← 돌아가기</Button>
      </div>

      <MembersSettings />
      <CategoriesSettings />
      <HolidaysSettings />
      <TrashSettings />
      <ExportSettings />
      <GuideSettings />
    </main>
  );
}
