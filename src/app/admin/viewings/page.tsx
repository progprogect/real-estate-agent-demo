import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { createViewing, setViewingCancelled } from '@/app/actions/config';
import { t } from '@/lib/strings';
import { formatVisitTime, formatWaiting } from '@/lib/format';
import { AdminPageHeader, Field, PrimaryButton, inputClass } from '@/components/ui';
import { StatusChip } from '@/components/StatusChip';

export const dynamic = 'force-dynamic';

export default async function ViewingsPage() {
  const session = await getSession();
  if (!session.userId) redirect('/login');
  if (session.role !== 'ADMIN') redirect('/visits');

  const [agents, visits] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'AGENT' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, branch: true },
    }),
    prisma.visit.findMany({
      orderBy: { visitDatetime: 'desc' },
      take: 40,
      include: { agent: { select: { name: true } } },
    }),
  ]);

  return (
    <main className="pb-12">
      <AdminPageHeader title={t.viewings.title} subtitle={t.viewings.subtitle} />

      <div className="space-y-5 px-5">
        <form action={createViewing} className="rounded-card border border-line bg-surface p-4">
          <h2 className="mb-3 font-display text-lg font-semibold">{t.viewings.addTitle}</h2>
          <Field label={t.viewings.assignTo}>
            <select name="agentId" required className={inputClass}>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.branch ? ` — ${a.branch}` : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t.viewings.address}>
            <input name="address" required className={inputClass} />
          </Field>
          <Field label={t.viewings.prospect}>
            <input name="prospectName" required className={inputClass} />
          </Field>
          <Field label={t.viewings.propertyRef}>
            <input name="propertyRef" placeholder="BE-1180-4412" className={inputClass} />
          </Field>
          <Field label={t.viewings.when} help={t.viewings.hoursAgoHelp}>
            <input name="when" type="datetime-local" className={inputClass} />
          </Field>
          <PrimaryButton type="submit">{t.viewings.add}</PrimaryButton>
        </form>

        <ul className="overflow-hidden rounded-card border border-line bg-surface">
          {visits.map((v, i) => {
            const { time, date } = formatVisitTime(v.visitDatetime);
            const open = v.status === 'PENDING' || v.status === 'REMINDER_SENT' || v.status === 'DRAFT';
            return (
              <li key={v.id} className={`px-4 py-3 ${i > 0 ? 'dotted-divider' : ''}`}>
                <Link href={`/admin/viewings/${v.id}`} className="block">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium underline underline-offset-2">
                      {v.address}
                    </span>
                    <StatusChip status={v.status} />
                  </div>
                </Link>
                <p className="mt-1 text-xs text-stone">
                  {v.agent.name} · {v.prospectName} · {date}, <span className="tnum">{time}</span>
                  {open && ` · ${formatWaiting(v.visitDatetime)}`}
                </p>
                <form action={setViewingCancelled} className="mt-2">
                  <input type="hidden" name="id" value={v.id} />
                  <input type="hidden" name="cancel" value={String(v.status !== 'CANCELLED')} />
                  <button
                    type="submit"
                    className="h-9 rounded-card border border-line bg-surface px-3 text-sm font-medium text-ink"
                  >
                    {v.status === 'CANCELLED' ? t.viewings.reopen : t.viewings.cancel}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
