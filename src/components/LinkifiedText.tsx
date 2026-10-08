import { splitLinks } from '../lib/linkify';

/**
 * 사용자 입력을 텍스트로만 그리되, http/https 주소는 링크로 만든다(PRD §5.4).
 * 링크는 새 탭에서 열고 rel="noopener noreferrer" 를 붙인다.
 */
export function LinkifiedText({ text }: { text: string }) {
  return (
    <>
      {splitLinks(text).map((part, index) =>
        part.type === 'link' ? (
          <a
            key={index}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-primary-text underline"
          >
            {part.value}
          </a>
        ) : (
          <span key={index}>{part.value}</span>
        ),
      )}
    </>
  );
}
