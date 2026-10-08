import { useId } from 'react';
import type { ReactNode } from 'react';

export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-4 rounded-md border border-border bg-surface p-4 shadow-card"
    >
      <div className="flex flex-col gap-1">
        <h3 id={headingId} className="text-lg font-semibold">
          {title}
        </h3>
        {description && <p className="text-sm text-text-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function FormError({ id, message }: { id?: string; message: string | null }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-sm text-danger">
      {message}
    </p>
  );
}

export const textInputClass =
  'min-h-touch w-full rounded-md border border-border bg-surface px-3 text-base text-text';
