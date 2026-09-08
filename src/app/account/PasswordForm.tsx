'use client';

import { useActionState } from 'react';
import { changePassword, type PasswordState } from '@/app/actions/account';
import { t } from '@/lib/strings';
import { Field, PrimaryButton, inputClass } from '@/components/ui';

export function PasswordForm() {
  const [state, action, pending] = useActionState<PasswordState, FormData>(changePassword, {});

  return (
    <form action={action} className="rounded-card border border-line bg-surface p-4">
      <Field label={t.account.current}>
        <input name="current" type="password" required autoComplete="current-password" className={inputClass} />
      </Field>
      <Field label={t.account.next}>
        <input name="next" type="password" required autoComplete="new-password" className={inputClass} />
      </Field>
      <Field label={t.account.confirm}>
        <input name="repeat" type="password" required autoComplete="new-password" className={inputClass} />
      </Field>

      {state.error && <p className="mb-3 text-sm text-brick">{state.error}</p>}
      {state.done && <p className="mb-3 text-sm font-medium text-moss">{t.account.changed}</p>}

      <PrimaryButton type="submit" disabled={pending}>
        {t.account.submit}
      </PrimaryButton>
    </form>
  );
}
