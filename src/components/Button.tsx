import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'on-brand';

const variants: Record<Variant, string> = {
  // 주요 버튼: 그라디언트 + 흰 텍스트 (PRD §6.4)
  primary: 'bg-brand text-on-brand border-transparent shadow-card',
  // 보조 버튼: 흰 배경 + 테두리
  secondary: 'bg-surface text-text border-border',
  // 그라디언트 위(헤더)에 놓는 버튼
  // 헤더(밝은 반투명 표면) 위의 버튼
  'on-brand': 'bg-surface text-text border-border hover:border-primary-text',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({
  variant = 'secondary',
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-touch min-w-touch items-center justify-center gap-2 rounded-md border px-4 text-sm font-semibold transition duration-fast ease-brand disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
      {...rest}
    />
  );
}
