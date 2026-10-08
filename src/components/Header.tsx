import { SearchBox } from '../features/filters/SearchBox';
import { useConnectionStore } from '../stores/connectionStore';
import { useTaskStore } from '../stores/taskStore';
import { MemberAvatar } from './Avatar';
import { Button } from './Button';
import { ThemeToggle } from './ThemeToggle';

interface HeaderProps {
  onNewTask: () => void;
  onOpenSettings: () => void;
  /** 제목을 누르면 메인(칸반, 필터 해제)으로 돌아간다 */
  onHome: () => void;
  userName: string | null;
  onChangeName: () => void;
}

export function Header({ userName, onChangeName, onNewTask, onOpenSettings, onHome }: HeaderProps) {
  const offline = useConnectionStore((s) => s.status === 'offline');
  // 현재 사용자의 팀원 정보(아바타 색). 이름이 팀원 목록에 있어야 색이 보인다.
  const me = useTaskStore((s) => s.members.find((m) => m.active && m.name === userName));

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-header-bg text-text backdrop-blur-md">
      <div className="mx-auto flex min-h-header max-w-content flex-wrap items-center gap-3 px-4 py-2">
        {/* 그라디언트 위 텍스트는 큰 글자(굵게)로 둔다 */}
        <h1 className="text-xl font-bold tracking-tight">
          <a
            href="./"
            onClick={(event) => {
              event.preventDefault();
              onHome();
            }}
            className="rounded-sm"
          >
            백령지사 공용업무 캘린더
          </a>
        </h1>

        {offline && (
          // 실시간 연결이 끊기면 30초마다 다시 불러오며 재연결을 시도한다(PRD §5.7)
          <p
            role="status"
            className="rounded-pill bg-surface px-3 py-1 text-sm font-semibold text-text"
          >
            오프라인 — 재연결 중
          </p>
        )}

        <SearchBox />

        <Button variant="on-brand" onClick={onNewTask}>
          + 새 할일
        </Button>

        <ThemeToggle />

        <Button variant="on-brand" onClick={onOpenSettings} aria-label="설정">
          {/* 슬라이더 모양 설정 아이콘 */}
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            className="h-5 w-5"
          >
            <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
            <circle cx={16} cy={7} r={2} />
            <circle cx={8} cy={17} r={2} />
          </svg>
        </Button>

        <Button
          variant="on-brand"
          onClick={onChangeName}
          aria-label={userName ? `현재 사용자 ${userName}. 눌러서 이름 변경` : '이름 입력'}
        >
          {me && <MemberAvatar member={me} />}
          {userName ?? '이름 입력'}
        </Button>
      </div>
    </header>
  );
}
