// Postgres timestamptz 는 마이크로초 정밀도('2026-10-07T05:00:00.123456+00:00')지만
// JS Date 는 밀리초까지만 다룬다. 같은 밀리초 안의 두 수정도 구분하려고 소수 자리를 직접 비교한다.

function parts(ts: string): { ms: number; micro: number } {
  const ms = Date.parse(ts);
  const fraction = /\.(\d+)/.exec(ts)?.[1] ?? '';
  const micro = Number(fraction.padEnd(6, '0').slice(3, 6));
  return { ms, micro };
}

/** a 가 더 오래되면 음수, 같으면 0, 더 최신이면 양수 */
export function compareTimestamps(a: string, b: string): number {
  const pa = parts(a);
  const pb = parts(b);
  return pa.ms - pb.ms || pa.micro - pb.micro;
}
