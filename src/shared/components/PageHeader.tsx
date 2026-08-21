import type { ReactNode } from 'react';

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-2 px-fluid-md pt-safe-top pb-2">
      <div>
        <h1 className="pt-fluid-md text-fluid-2xl font-bold">{title}</h1>
        {subtitle ? (
          <p className="text-fluid-sm text-ink-soft">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </header>
  );
}
