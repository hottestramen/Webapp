import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// PRD §5.3: 본문 텍스트 4.5:1 이상, 그라디언트 위 텍스트는 가장 밝은 지점 기준으로도 4.5:1,
// 배지는 배경/텍스트 쌍으로 4.5:1, 아이콘·그래픽은 3:1. 라이트와 다크 두 테마 모두에서
// 토큰 값을 바꿀 때 이 기준이 깨지지 않게 막는다.

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');

const DARK_START = css.indexOf(":root[data-theme='dark']");
const DARK_END = css.indexOf('}', DARK_START);
const lightCss = css.slice(0, DARK_START);
const darkCss = css.slice(DARK_START, DARK_END);

const parse = (source: string): Record<string, string> =>
  Object.fromEntries(
    [...source.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2] as string]),
  );

const light = parse(lightCss);
// 다크는 라이트 토큰 위에 덮어쓴 값이다
const themes: Record<string, Record<string, string>> = {
  light,
  dark: { ...light, ...parse(darkCss) },
};

const channel = (c: number) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel(n >> 16) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}
function ratio(a: string, b: string): number {
  const [hi = 0, lo = 0] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('다크 모드 토큰 구조', () => {
  it('다크 블록이 있고, 색 토큰만 덮어쓴다', () => {
    expect(DARK_START).toBeGreaterThan(0);
    expect(darkCss).not.toMatch(/--(space|radius|text-(xs|sm|base|lg|xl|2xl)|motion|font)/);
  });
});

for (const [themeName, vars] of Object.entries(themes)) {
  const v = (name: string): string => {
    const value = vars[name];
    if (!value) throw new Error(`토큰이 없습니다: --${name}`);
    return value;
  };

  describe(`명도 대비 — ${themeName} 테마 (텍스트 4.5:1)`, () => {
    const textPairs: [string, string, string][] = [
      ['본문/배경', 'color-text', 'color-bg'],
      ['본문/표면', 'color-text', 'color-surface'],
      ['보조 텍스트/배경', 'color-text-muted', 'color-bg'],
      ['보조 텍스트/표면', 'color-text-muted', 'color-surface'],
      ['오류 텍스트/표면', 'color-danger', 'color-surface'],
      ['공휴일/표면', 'color-holiday', 'color-surface'],
      ['공휴일/배경(이웃 달 날짜)', 'color-holiday', 'color-bg'],
      ['토요일/표면', 'color-saturday', 'color-surface'],
      ['토요일/배경(이웃 달 날짜)', 'color-saturday', 'color-bg'],
      ['강조 텍스트(링크·선택 탭)/표면', 'color-primary-text', 'color-surface'],
      ['강조 텍스트/배경', 'color-primary-text', 'color-bg'],
    ];
    for (const [name, fg, bg] of textPairs) {
      it(name, () => expect(ratio(v(fg), v(bg))).toBeGreaterThanOrEqual(4.5));
    }

    it('그라디언트(주요 버튼·선택된 탭) 위 흰 글자: 모든 지점이 4.5:1 이상', () => {
      const gradient = /--gradient-brand:[^;]*;/.exec(css)?.[0] ?? '';
      const stops = [...gradient.matchAll(/#[0-9a-fA-F]{6}/g)].map((m) => m[0]);
      expect(stops.length).toBeGreaterThanOrEqual(2);
      for (const stop of stops) {
        expect(ratio(v('color-on-brand'), stop)).toBeGreaterThanOrEqual(4.5);
      }
    });

    for (const key of [
      'todo',
      'progress',
      'done',
      'high',
      'medium',
      'low',
      'due-soon',
      'overdue',
    ]) {
      it(`배지 ${key}`, () => {
        expect(ratio(v(`badge-${key}-text`), v(`badge-${key}-bg`))).toBeGreaterThanOrEqual(4.5);
      });
    }

    for (let i = 1; i <= 8; i++) {
      it(`아바타 ${i} 위 흰 글자`, () => {
        expect(ratio(v('avatar-text'), v(`avatar-${i}`))).toBeGreaterThanOrEqual(4.5);
      });
    }

    it('휴가 칩(텍스트/배경)', () => {
      expect(ratio(v('leave-text'), v('leave-bg'))).toBeGreaterThanOrEqual(4.5);
    });

    it('출장 칩(텍스트/배경)', () => {
      expect(ratio(v('trip-text'), v('trip-bg'))).toBeGreaterThanOrEqual(4.5);
    });

    it('오늘 표시(흰 글자/강조색 배경)', () => {
      expect(ratio(v('color-on-brand'), v('color-primary-strong'))).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe(`명도 대비 — ${themeName} 테마 (그래픽 3:1)`, () => {
    for (const key of ['high', 'medium', 'low']) {
      it(`우선순위 점 ${key}/표면`, () => {
        expect(ratio(v(`badge-${key}-text`), v('color-surface'))).toBeGreaterThanOrEqual(3);
      });
    }
    it('차트 막대/표면', () => {
      expect(ratio(v('color-chart'), v('color-surface'))).toBeGreaterThanOrEqual(3);
    });
    it('포커스 링/표면', () => {
      expect(ratio(v('color-focus'), v('color-surface'))).toBeGreaterThanOrEqual(3);
    });
  });
}
