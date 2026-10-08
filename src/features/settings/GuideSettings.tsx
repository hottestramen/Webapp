import { IDENTITY_LIMIT_NOTICE } from '../user/NameModal';
import { SettingsSection } from './SettingsSection';

/** 사용 안내: 식별 한계(PRD §5.6)와 접근 범위(§5.4) */
export function GuideSettings() {
  return (
    <SettingsSection title="사용 안내">
      <p className="rounded-md bg-bg p-3 text-sm font-semibold">
        외부 공유 금지, 개인정보 입력 금지. 링크는 부서 내부에서만 공유하세요.
      </p>

      <div className="flex flex-col gap-2 text-sm">
        <h4 className="font-semibold">이름 입력 방식의 한계</h4>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>{IDENTITY_LIMIT_NOTICE}</li>
          <li>
            다른 사람 이름을 입력하면 그 사람으로 작성·수정할 수 있습니다(사칭을 막을 수 없습니다).
          </li>
          <li>이름이 같은 팀원은 구분할 수 없습니다. “김하늘(기획)”처럼 소속을 붙여 등록하세요.</li>
          <li>작성자·수정자 기록은 참고용이며, 책임 추적이나 감사의 근거로 쓸 수 없습니다.</li>
        </ul>
      </div>

      <div className="flex flex-col gap-2 text-sm">
        <h4 className="font-semibold">데이터 보호</h4>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>
            로그인이 없어서, 이 앱의 주소와 공개 키를 아는 사람은 누구나 할일을 읽고 쓸 수 있습니다.
          </li>
          <li>
            삭제한 할일·댓글은 화면에서 사라지지만 DB에는 남습니다. 복구는 관리자에게 요청하세요.
          </li>
          <li>
            완료한 지 7일이 지난 할일은 휴지통(설정)으로 자동 이동하며, 거기서 복원할 수 있습니다.
          </li>
          <li>팀원·카테고리는 삭제되지 않고 비활성·숨김 처리만 됩니다.</li>
        </ul>
      </div>
    </SettingsSection>
  );
}
