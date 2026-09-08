import Link from 'next/link';
import { t } from '@/lib/strings';

export function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="mb-3 block">
      <span className="overline-label mb-1.5 block">{label}</span>
      {children}
      {help && <span className="mt-1 block text-xs text-stone">{help}</span>}
    </label>
  );
}

export const inputClass =
  'h-11 w-full rounded-card border border-line bg-surface px-3 text-[15px] outline-none focus:border-pine focus:ring-2 focus:ring-pine/30';

export const textareaClass =
  'w-full rounded-card border border-line bg-surface p-3 text-[15px] outline-none focus:border-pine focus:ring-2 focus:ring-pine/30';

export function PrimaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`h-11 w-full rounded-card bg-ink text-sm font-medium text-paper disabled:opacity-60 ${props.className ?? ''}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`h-10 rounded-card border border-line bg-surface px-3 text-sm font-medium text-ink disabled:opacity-60 ${props.className ?? ''}`}
    >
      {children}
    </button>
  );
}

export function Card({ children }: { children: React.ReactNode }) {
  return <section className="rounded-card border border-line bg-surface p-4">{children}</section>;
}

export function AdminPageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="px-5 pb-4 pt-5">
      <Link href="/admin" className="text-sm text-pine underline underline-offset-2">
        ← {t.nav.admin}
      </Link>
      <h1 className="mt-3 font-display text-2xl font-semibold">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-stone">{subtitle}</p>}
    </header>
  );
}
