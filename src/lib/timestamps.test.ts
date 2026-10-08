import { describe, expect, it } from 'vitest';
import { compareTimestamps } from './timestamps';

describe('compareTimestamps', () => {
  it('서로 다른 형식(Z / +00:00)도 같은 시각이면 0', () => {
    expect(compareTimestamps('2026-10-07T05:00:00.123Z', '2026-10-07T05:00:00.123000+00:00')).toBe(
      0,
    );
  });

  it('밀리초가 같아도 마이크로초로 앞뒤를 가린다', () => {
    expect(
      compareTimestamps('2026-10-07T05:00:00.123001+00:00', '2026-10-07T05:00:00.123002+00:00'),
    ).toBeLessThan(0);
    expect(
      compareTimestamps('2026-10-07T05:00:00.123456+00:00', '2026-10-07T05:00:00.123455+00:00'),
    ).toBeGreaterThan(0);
  });

  it('시각이 다르면 시각으로 비교', () => {
    expect(
      compareTimestamps('2026-10-07T05:00:01.000000+00:00', '2026-10-07T05:00:00.999999+00:00'),
    ).toBeGreaterThan(0);
  });
});
