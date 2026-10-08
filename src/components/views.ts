export type ViewId = 'kanban' | 'list' | 'calendar' | 'dashboard';

export const VIEWS: readonly { id: ViewId; label: string }[] = [
  { id: 'kanban', label: '칸반' },
  { id: 'list', label: '리스트' },
  { id: 'calendar', label: '캘린더' },
  { id: 'dashboard', label: '대시보드' },
];
