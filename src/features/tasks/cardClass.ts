import type { Task } from '../../types';

// 우선순위 high 는 왼쪽에 색 띠를 함께 표시한다(PRD §6.3).
// 다른 팀원이 방금 바꾼 카드(flashing)는 1.5초간 테두리 색을 바꾸고, 움직임 줄이기가 꺼져 있으면 그림자도 잠깐 키운다.
export const cardClass = (task: Task, flashing = false) =>
  `rounded-md border ${
    flashing ? 'border-primary-strong motion-safe:animate-flash' : 'border-border'
  } bg-surface p-3 text-left text-text shadow-card ${
    task.priority === 'high' ? 'border-l-stripe border-l-badge-high-text' : ''
  }`;
