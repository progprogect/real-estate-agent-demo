'use client';

import { useState, useTransition } from 'react';
import { createPerson, resetPersonPassword } from '@/app/actions/config';
import { t } from '@/lib/strings';
import { Field, PrimaryButton, SecondaryButton, inputClass } from '@/components/ui';
import { StatusChip } from '@/components/StatusChip';

type Person = {
  id: string;
  name: string;
  email: string;
  branch: string | null;
  role: string;
  zohoUserId: string | null;
  visits: number;
};

export function PeopleManager({ people }: { people: Person[] }) {
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submitNew = (formData: FormData) =>
    startTransition(async () => {
      const created = await createPerson(formData);
      if (created) {
        setNotice(t.people.created(created.email, created.password));
        setAdding(false);
      }
    });

  const reset = (id: string) =>
    startTransition(async () => {
      const formData = new FormData();
      formData.set('id', id);
      const done = await resetPersonPassword(formData);
      if (done) setNotice(t.people.reset(done.email, done.password));
    });

  return (
    <div className="space-y-4">
      {notice && (
        <section className="rounded-card border border-pine/40 bg-pine-soft p-4">
          <p className="text-sm font-medium">{notice}</p>
          <p className="mt-1 text-xs text-stone">{t.people.tempPasswordHelp}</p>
        </section>
      )}

      <ul className="overflow-hidden rounded-card border border-line bg-surface">
        {people.map((p, i) => (
          <li key={p.id} className={`px-4 py-3 ${i > 0 ? 'dotted-divider' : ''}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
              <StatusChip
                status={p.role === 'ADMIN' ? 'ANSWERED' : 'PENDING'}
                label={p.role === 'ADMIN' ? t.people.roleAdmin : t.people.roleAgent}
              />
            </div>
            <p className="mt-1 text-xs text-stone">
              {p.email}
              {p.branch ? ` · ${p.branch}` : ''}
              {p.zohoUserId ? ` · ${p.zohoUserId}` : ''} · {t.people.visitsCount(p.visits)}
            </p>
            <SecondaryButton
              type="button"
              disabled={pending}
              onClick={() => reset(p.id)}
              className="mt-2"
            >
              {t.people.resetPassword}
            </SecondaryButton>
          </li>
        ))}
      </ul>

      {!adding ? (
        <SecondaryButton type="button" onClick={() => setAdding(true)} className="w-full">
          + {t.people.add}
        </SecondaryButton>
      ) : (
        <form action={submitNew} className="rounded-card border border-line bg-surface p-4">
          <h2 className="mb-3 font-display text-lg font-semibold">{t.people.addTitle}</h2>
          <Field label={t.people.name}>
            <input name="name" required className={inputClass} />
          </Field>
          <Field label={t.people.email}>
            <input name="email" type="email" required className={inputClass} />
          </Field>
          <Field label={t.people.branch}>
            <input name="branch" className={inputClass} />
          </Field>
          <Field label={t.people.role}>
            <select name="role" defaultValue="AGENT" className={inputClass}>
              <option value="AGENT">{t.people.roleAgent}</option>
              <option value="ADMIN">{t.people.roleAdmin}</option>
            </select>
          </Field>
          <Field label={t.people.zohoId}>
            <input name="zohoUserId" className={inputClass} />
          </Field>
          <div className="flex gap-2">
            <SecondaryButton type="button" onClick={() => setAdding(false)} className="flex-1">
              {t.feedback.cancelEdit}
            </SecondaryButton>
            <PrimaryButton type="submit" disabled={pending} className="flex-1">
              {t.people.add}
            </PrimaryButton>
          </div>
        </form>
      )}
    </div>
  );
}
