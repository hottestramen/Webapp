/**
 * 클라이언트에서 만드는 UUID. 등록할 때 id 를 미리 정해 두면, 내가 보낸 INSERT 가 실시간으로 되돌아와도
 * 같은 id 로 합쳐져 카드가 두 장 생기지 않는다(PRD §5.7).
 * crypto.randomUUID 는 보안 컨텍스트(https, localhost)에서만 있어서 getRandomValues 로 대체한다.
 */
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
