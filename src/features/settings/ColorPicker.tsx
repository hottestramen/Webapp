interface ColorPickerProps<K extends string> {
  /** 팔레트 키 목록(디자인 토큰: avatar-1~8, cat-1~8) */
  keys: readonly K[];
  /** 키 → 배경색 클래스(토큰) */
  classes: Record<K, string>;
  value: K;
  onChange: (key: K) => void;
  /** "아바타 색", "카테고리 색" 등 접근성 이름의 앞부분 */
  label: string;
  disabled?: boolean;
}

/** 토큰 팔레트 안에서 색을 고른다. 선택은 색뿐 아니라 ✓ 표시와 aria-pressed 로도 알린다. */
export function ColorPicker<K extends string>({
  keys,
  classes,
  value,
  onChange,
  label,
  disabled,
}: ColorPickerProps<K>) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {keys.map((key, index) => {
        const selected = key === value;
        return (
          <button
            key={key}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            aria-label={`${label} ${index + 1}${selected ? ' (선택됨)' : ''}`}
            onClick={() => onChange(key)}
            className={`inline-flex h-touch w-touch items-center justify-center rounded-pill border text-base font-bold text-on-brand ${classes[key]} ${
              selected ? 'border-text' : 'border-transparent'
            }`}
          >
            <span aria-hidden="true">{selected ? '✓' : ''}</span>
          </button>
        );
      })}
    </div>
  );
}
