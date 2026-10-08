import { describe, expect, it } from 'vitest';
import { splitLinks } from './linkify';

describe('splitLinks', () => {
  it('링크가 없으면 텍스트 하나', () => {
    expect(splitLinks('그냥 메모')).toEqual([{ type: 'text', value: '그냥 메모' }]);
  });

  it('http/https 주소를 링크로 나눈다', () => {
    expect(splitLinks('참고: https://example.com/doc 확인')).toEqual([
      { type: 'text', value: '참고: ' },
      { type: 'link', value: 'https://example.com/doc', href: 'https://example.com/doc' },
      { type: 'text', value: ' 확인' },
    ]);
    expect(splitLinks('http://a.com')[0]).toMatchObject({ type: 'link' });
  });

  it('문장 끝 문장부호는 주소에서 뺀다', () => {
    const parts = splitLinks('자료는 https://example.com/a. 입니다');
    expect(parts[1]).toMatchObject({ type: 'link', value: 'https://example.com/a' });
    expect(splitLinks('(https://example.com/a)')[1]).toMatchObject({
      value: 'https://example.com/a',
    });
  });

  it('주소 안의 괄호는 유지한다', () => {
    expect(splitLinks('https://ko.wikipedia.org/wiki/A_(b)')[0]).toMatchObject({
      value: 'https://ko.wikipedia.org/wiki/A_(b)',
    });
  });

  it('javascript:, data:, ftp: 등 http/https 가 아닌 것은 링크로 만들지 않는다', () => {
    for (const text of [
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'ftp://x.com/a',
    ]) {
      expect(splitLinks(text).every((p) => p.type === 'text')).toBe(true);
    }
  });

  it('HTML 태그는 해석하지 않고 텍스트로 둔다', () => {
    const parts = splitLinks('<script>alert(1)</script> https://example.com');
    expect(parts[0]).toEqual({ type: 'text', value: '<script>alert(1)</script> ' });
    expect(parts[1]).toMatchObject({ type: 'link', href: 'https://example.com/' });
  });

  it('여러 링크', () => {
    const links = splitLinks('https://a.com 와 https://b.com').filter((p) => p.type === 'link');
    expect(links).toHaveLength(2);
  });
});
