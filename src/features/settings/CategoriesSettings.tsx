import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../../components/Button';
import { CATEGORY_BG_CLASS, CATEGORY_KEYS } from '../../lib/labels';
import { useTaskStore } from '../../stores/taskStore';
import type { Category, CategoryColorKey } from '../../types';
import { ColorPicker } from './ColorPicker';
import { FormError, SettingsSection, textInputClass } from './SettingsSection';

const NAME_MAX = 20;

interface CategoryRowProps {
  category: Category;
  isFirst: boolean;
  isLast: boolean;
}

function CategoryRow({ category, isFirst, isLast }: CategoryRowProps) {
  const editCategory = useTaskStore((s) => s.editCategory);
  const moveCategory = useTaskStore((s) => s.moveCategory);
  const [name, setName] = useState(category.name);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputId = useId();
  const errorId = useId();

  async function run(action: () => Promise<string | null>) {
    setBusy(true);
    setError(await action());
    setBusy(false);
  }

  return (
    <li
      className={`flex flex-col gap-2 rounded-md border border-border p-3 ${
        category.active ? 'bg-surface' : 'bg-bg'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 rounded-pill ${CATEGORY_BG_CLASS[category.color]}`}
        />

        <label htmlFor={inputId} className="sr-only">
          {category.name} 이름 변경
        </label>
        <input
          id={inputId}
          type="text"
          value={name}
          maxLength={NAME_MAX + 10}
          onChange={(e) => setName(e.target.value)}
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error ? true : undefined}
          className={`${textInputClass} min-w-0 flex-1`}
        />

        <Button
          disabled={busy || name.trim() === category.name}
          onClick={() => void run(() => editCategory(category.id, { name }))}
        >
          이름 저장
        </Button>
        <Button
          aria-label={`${category.name} 위로 이동`}
          disabled={busy || isFirst}
          onClick={() => void run(() => moveCategory(category.id, -1))}
        >
          <span aria-hidden="true">↑</span>
        </Button>
        <Button
          aria-label={`${category.name} 아래로 이동`}
          disabled={busy || isLast}
          onClick={() => void run(() => moveCategory(category.id, 1))}
        >
          <span aria-hidden="true">↓</span>
        </Button>
        <Button
          disabled={busy}
          onClick={() => void run(() => editCategory(category.id, { active: !category.active }))}
        >
          {category.active ? '숨김' : '다시 표시'}
        </Button>
      </div>

      {!category.active && (
        <p className="text-xs text-text-muted">
          숨긴 카테고리입니다. 새 할일의 선택 목록에는 나오지 않고, 기존 할일에는 그대로 남습니다.
        </p>
      )}

      <details>
        <summary className="min-h-touch cursor-pointer py-2 text-sm font-semibold">색</summary>
        <ColorPicker
          label={`${category.name} 색`}
          keys={CATEGORY_KEYS}
          classes={CATEGORY_BG_CLASS}
          value={category.color}
          disabled={busy}
          onChange={(color) => void run(() => editCategory(category.id, { color }))}
        />
      </details>

      <FormError id={errorId} message={error} />
    </li>
  );
}

/** 카테고리 추가·이름 변경·색·순서 변경·숨김(F-T-08). 삭제는 없다. */
export function CategoriesSettings() {
  const categories = useTaskStore((s) => s.categories);
  const addCategory = useTaskStore((s) => s.addCategory);
  const [name, setName] = useState('');
  const [color, setColor] = useState<CategoryColorKey>('cat-1');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputId = useId();
  const errorId = useId();

  const sorted = [...categories].sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'ko'),
  );

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const message = await addCategory(name, color);
    setBusy(false);
    setError(message);
    if (!message) setName('');
  }

  return (
    <SettingsSection
      title="카테고리 관리"
      description="카테고리는 삭제하지 않고 숨김 처리만 할 수 있습니다. 위·아래 버튼으로 선택 목록의 순서를 바꿉니다."
    >
      <form onSubmit={handleAdd} noValidate className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={inputId} className="text-sm font-semibold">
            새 카테고리 이름 (1~{NAME_MAX}자)
          </label>
          <input
            id={inputId}
            type="text"
            value={name}
            maxLength={NAME_MAX + 10}
            onChange={(e) => setName(e.target.value)}
            aria-describedby={error ? errorId : undefined}
            aria-invalid={error ? true : undefined}
            className={textInputClass}
          />
        </div>
        <ColorPicker
          label="새 카테고리 색"
          keys={CATEGORY_KEYS}
          classes={CATEGORY_BG_CLASS}
          value={color}
          onChange={setColor}
        />
        <FormError id={errorId} message={error} />
        <div>
          <Button type="submit" variant="primary" disabled={busy}>
            카테고리 추가
          </Button>
        </div>
      </form>

      <ul className="flex flex-col gap-2">
        {sorted.map((c, index) => (
          <CategoryRow
            key={c.id}
            category={c}
            isFirst={index === 0}
            isLast={index === sorted.length - 1}
          />
        ))}
      </ul>
    </SettingsSection>
  );
}
