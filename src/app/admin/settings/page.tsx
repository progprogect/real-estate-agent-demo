import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { getSettings, SETTINGS } from '@/lib/settings';
import { saveSettings, triggerStateCheck } from '@/app/actions/config';
import { t } from '@/lib/strings';
import { OUTPUT_LANGUAGES } from '@/lib/types';
import { AdminPageHeader, Field, PrimaryButton, SecondaryButton, inputClass } from '@/components/ui';
import { StatusChip } from '@/components/StatusChip';

export const dynamic = 'force-dynamic';

const eventChip: Record<string, string> = {
  delivered: 'ANSWERED',
  failed: 'FAILED',
  not_configured: 'PENDING',
};

const eventLabel: Record<string, string> = {
  delivered: t.events.delivered,
  failed: t.events.failed,
  not_configured: t.events.notConfigured,
};

export default async function SettingsPage() {
  const session = await getSession();
  if (!session.userId) redirect('/login');
  if (session.role !== 'ADMIN') redirect('/visits');

  const [values, events] = await Promise.all([
    getSettings(),
    prisma.webhookEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 25 }),
  ]);

  return (
    <main className="pb-12">
      <AdminPageHeader title={t.settings.title} subtitle={t.settings.subtitle} />

      <div className="space-y-5 px-5">
        <form action={saveSettings} className="rounded-card border border-line bg-surface p-4">
          <Field label={t.settings.language} help={t.settings.languageHelp}>
            <select
              name="outputLanguage"
              defaultValue={values[SETTINGS.outputLanguage]}
              className={inputClass}
            >
              {OUTPUT_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </Field>

          <p className="overline-label mb-2 mt-5">{t.settings.reminders}</p>
          <p className="mb-3 text-xs text-stone">{t.settings.remindersHelp}</p>
          <div className="grid grid-cols-3 gap-2">
            <Field label={t.settings.firstReminder}>
              <input
                name="reminderFirstHours"
                type="number"
                min={1}
                defaultValue={values[SETTINGS.reminderFirstHours]}
                className={inputClass}
              />
            </Field>
            <Field label={t.settings.secondReminder}>
              <input
                name="reminderSecondHours"
                type="number"
                min={1}
                defaultValue={values[SETTINGS.reminderSecondHours]}
                className={inputClass}
              />
            </Field>
            <Field label={t.settings.expiry}>
              <input
                name="expiryDays"
                type="number"
                min={1}
                defaultValue={values[SETTINGS.expiryDays]}
                className={inputClass}
              />
            </Field>
          </div>

          <p className="overline-label mb-2 mt-4">{t.settings.webhook}</p>
          <Field label={t.settings.webhookUrl} help={t.settings.webhookHelp}>
            <input
              name="webhookUrl"
              type="url"
              placeholder="https://…"
              defaultValue={values[SETTINGS.webhookUrl]}
              className={inputClass}
            />
          </Field>
          <Field label={t.settings.webhookToken}>
            <input
              name="webhookToken"
              defaultValue={values[SETTINGS.webhookToken]}
              className={inputClass}
            />
          </Field>

          <p className="overline-label mb-2 mt-4">{t.settings.zohoFilter}</p>
          <Field label={t.settings.zohoFilter} help={t.settings.zohoFilterHelp}>
            <input
              name="zohoViewingFilter"
              defaultValue={values[SETTINGS.zohoViewingFilter]}
              className={inputClass}
            />
          </Field>

          <PrimaryButton type="submit">{t.settings.save}</PrimaryButton>
        </form>

        <form action={triggerStateCheck}>
          <SecondaryButton type="submit" className="w-full">
            {t.settings.runStateCheck}
          </SecondaryButton>
        </form>

        <section>
          <p className="overline-label mb-1">{t.events.title}</p>
          <p className="mb-2 text-xs text-stone">{t.events.subtitle}</p>
          {events.length === 0 ? (
            <p className="rounded-card border border-line bg-surface px-4 py-3 text-sm text-stone">
              {t.events.empty}
            </p>
          ) : (
            <ul className="overflow-hidden rounded-card border border-line bg-surface">
              {events.map((e, i) => (
                <li key={e.id} className={`px-4 py-3 ${i > 0 ? 'dotted-divider' : ''}`}>
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-sm font-medium">{e.type}</code>
                    <StatusChip
                      status={eventChip[e.status] ?? 'PENDING'}
                      label={eventLabel[e.status] ?? e.status}
                    />
                  </div>
                  <p className="mt-1 text-xs text-stone">
                    {e.createdAt.toLocaleString('en-GB')}
                    {e.responseCode ? ` · HTTP ${e.responseCode}` : ''}
                    {e.error ? ` · ${e.error.slice(0, 80)}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
