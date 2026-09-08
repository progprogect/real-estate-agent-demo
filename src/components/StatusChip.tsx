import { t } from '@/lib/strings';

const styles: Record<string, string> = {
  PENDING: 'bg-amber-soft text-amber',
  DRAFT: 'bg-amber-soft text-amber',
  ANSWERED: 'bg-moss-soft text-moss',
  EXPIRED: 'bg-paper text-stone',
  CANCELLED: 'bg-paper text-stone',
  FAILED: 'bg-brick-soft text-brick',
};

export function StatusChip({ status, label }: { status: string; label?: string }) {
  return (
    <span
      className={`inline-block rounded-chip px-2 py-1 text-xs font-medium ${styles[status] ?? 'bg-paper text-stone'}`}
    >
      {label ?? t.status[status] ?? status}
    </span>
  );
}
