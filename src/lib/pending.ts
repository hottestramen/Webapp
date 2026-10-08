// 서버에 저장되기 전(낙관적 업데이트 중)인 항목의 id. 저장 중에는 열거나 수정하지 못하게 하고,
// 전체 새로고침이 이 항목을 지워 버리지 않게 한다.
const pending = new Set<string>();

export const markPending = (id: string): void => void pending.add(id);
export const clearPending = (id: string): void => void pending.delete(id);
export const isPending = (id: string): boolean => pending.has(id);
