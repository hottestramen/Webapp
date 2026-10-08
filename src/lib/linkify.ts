// 설명 텍스트의 URL 자동 링크(PRD §5.4). http/https 만 링크로 만들고, 나머지는 모두 텍스트로 남긴다.
// HTML 을 만들지 않고 조각 목록만 돌려주며, 화면에서는 React 요소로 그린다(HTML 문자열을 직접 넣지 않는다).

export type TextPart =
  { type: 'text'; value: string } | { type: 'link'; value: string; href: string };

const URL_PATTERN = /https?:\/\/[^\s<>"'`]+/gi;
const TRAILING_PUNCTUATION = ',.;:!?\'"]}>';

const count = (text: string, ch: string) => text.split(ch).length - 1;

/** 문장 끝에 붙은 문장부호(와 짝 없는 닫는 괄호)는 주소에 포함하지 않는다 */
function trimTrailing(raw: string): string {
  let s = raw;
  for (;;) {
    const ch = s.slice(-1);
    if (!ch) return s;
    if (TRAILING_PUNCTUATION.includes(ch)) s = s.slice(0, -1);
    else if (ch === ')' && count(s, ')') > count(s, '(')) s = s.slice(0, -1);
    else return s;
  }
}

function toSafeHref(candidate: string): string | null {
  try {
    const url = new URL(candidate);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function splitLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    const raw = trimTrailing(match[0]);
    const href = toSafeHref(raw);
    if (!href) continue;

    if (start > last) parts.push({ type: 'text', value: text.slice(last, start) });
    parts.push({ type: 'link', value: raw, href });
    last = start + raw.length;
  }

  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) });
  return parts;
}
