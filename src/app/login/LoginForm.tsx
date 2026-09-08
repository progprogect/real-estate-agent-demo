'use client';

import { useActionState } from 'react';
import { login } from '@/app/actions/auth';
import { t } from '@/lib/strings';

export function LoginForm() {
  const [state, action, pending] = useActionState(login, { error: false });

  return (
    <form action={action} className="rounded-card border border-line bg-surface p-5">
      <h2 className="mb-1 font-display text-xl font-semibold">{t.login.title}</h2>
      <p className="mb-5 text-sm text-stone">{t.login.subtitle}</p>

      <label className="overline-label mb-1.5 block" htmlFor="email">
        {t.login.email}
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        className="mb-4 h-12 w-full rounded-card border border-line bg-surface px-3 text-base outline-none focus:border-pine focus:ring-2 focus:ring-pine/30"
      />

      <label className="overline-label mb-1.5 block" htmlFor="password">
        {t.login.password}
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        className="mb-5 h-12 w-full rounded-card border border-line bg-surface px-3 text-base outline-none focus:border-pine focus:ring-2 focus:ring-pine/30"
      />

      {state.error && <p className="mb-4 text-sm text-brick">{t.login.invalid}</p>}

      <button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-card bg-ink text-base font-medium text-paper disabled:opacity-60"
      >
        {t.login.submit}
      </button>
    </form>
  );
}
