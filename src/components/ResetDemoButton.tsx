'use client';

import { useFormStatus } from 'react-dom';
import { resetDemoData } from '@/app/actions/admin';
import { t } from '@/lib/strings';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 w-full rounded-card border border-line bg-surface text-sm font-medium text-ink disabled:opacity-60"
    >
      {pending ? t.admin.resetting : t.admin.resetDemo}
    </button>
  );
}

export function ResetDemoButton() {
  return (
    <form action={resetDemoData}>
      <SubmitButton />
      <p className="mt-1.5 text-xs text-stone">{t.admin.resetNote}</p>
    </form>
  );
}
