import type { ReactNode } from "react";

type Props = {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
};

export default function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: Props) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="label-eyebrow">{eyebrow}</p>}
        <h1 className="mt-1.5 text-4xl text-forest-900 sm:text-[2.6rem] sm:leading-[1.1]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 max-w-2xl text-[0.95rem] leading-6 text-neutral-600">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </header>
  );
}
