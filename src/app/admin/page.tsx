import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { t } from '@/lib/strings';
import { formatVisitTime, formatWaiting } from '@/lib/format';
import { AppHeader } from '@/components/AppHeader';
import { StatusChip } from '@/components/StatusChip';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await getSession();
  if (!session.userId) redirect('/login');
  if (session.role !== 'ADMIN') redirect('/visits');

  // Administrator access is audited (a GDPR requirement in the brief).
  await prisma.auditLog.create({
    data: { userId: session.userId, action: 'admin.view_network', detail: 'Opened network view' },
  });

  const [agents, visits, failedSubmissions, inboxCount] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'AGENT' },
      select: { id: true, name: true, branch: true },
      orderBy: { name: 'asc' },
    }),
    prisma.visit.findMany({
      orderBy: { visitDatetime: 'desc' },
      include: { agent: { select: { name: true } } },
    }),
    prisma.submission.findMany({
      where: { status: 'FAILED' },
      include: { visit: { select: { address: true, agent: { select: { name: true } } } } },
      orderBy: { submittedAt: 'desc' },
    }),
    prisma.inboxEvent.count(),
  ]);

  const perAgent = agents.map((a) => {
    const mine = visits.filter((v) => v.agentId === a.id);
    const answered = mine.filter((v) => v.status === 'ANSWERED').length;
    const pending = mine.filter((v) => v.status === 'PENDING' || v.status === 'DRAFT').length;
    const answerable = mine.filter((v) => v.status !== 'CANCELLED').length;
    const rate = answerable === 0 ? 0 : Math.round((answered / answerable) * 100);
    return { ...a, answered, pending, rate };
  });

  return (
    <main className="pb-12">
      <AppHeader userName={session.name ?? ''} isAdmin currentView="admin" />

      <div className="px-5">
        <h1 className="mb-1 mt-2 font-display text-3xl font-semibold">{t.admin.title}</h1>
        <p className="mb-5 text-sm text-stone">{t.admin.subtitle}</p>

        {/* Agents */}
        <section className="mb-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="overline-label">{t.admin.agents}</p>
            <a
              href="/admin/export"
              className="text-sm font-medium text-pine underline underline-offset-2"
            >
              {t.admin.exportCsv}
            </a>
          </div>
          <div className="overflow-hidden rounded-card border border-line bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-stone">
                  <th className="px-4 py-2.5 font-medium">{t.admin.agent}</th>
                  <th className="px-2 py-2.5 font-medium">{t.admin.branch}</th>
                  <th className="px-2 py-2.5 text-right font-medium">{t.admin.pending}</th>
                  <th className="px-2 py-2.5 text-right font-medium">{t.admin.answeredCol}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{t.admin.responseRate}</th>
                </tr>
              </thead>
              <tbody>
                {perAgent.map((a) => (
                  <tr key={a.id} className="dotted-divider">
                    <td className="px-4 py-3 font-medium">{a.name}</td>
                    <td className="px-2 py-3 text-stone">{a.branch}</td>
                    <td className="tnum px-2 py-3 text-right">{a.pending}</td>
                    <td className="tnum px-2 py-3 text-right">{a.answered}</td>
                    <td className="tnum px-4 py-3 text-right font-display font-semibold">
                      {a.rate}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Submission errors */}
        <section className="mb-5">
          <p className="overline-label mb-2">{t.admin.submissionErrors}</p>
          {failedSubmissions.length === 0 ? (
            <p className="rounded-card border border-line bg-surface px-4 py-3 text-sm text-stone">
              {t.admin.noErrors}
            </p>
          ) : (
            <ul className="overflow-hidden rounded-card border border-line bg-surface">
              {failedSubmissions.map((s, i) => (
                <li key={s.id} className={`px-4 py-3 ${i > 0 ? 'dotted-divider' : ''}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{s.visit.address}</span>
                    <StatusChip status="FAILED" label="Failed" />
                  </div>
                  <p className="mt-1 text-xs text-stone">
                    {s.visit.agent.name} · {s.attempts} attempts · {s.lastError}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* All viewings */}
        <section className="mb-5">
          <p className="overline-label mb-2">
            {t.admin.visits} <span className="tnum">({visits.length})</span>
          </p>
          <ul className="overflow-hidden rounded-card border border-line bg-surface">
            {visits.map((v, i) => {
              const { time, date } = formatVisitTime(v.visitDatetime);
              const waiting = v.status === 'PENDING' || v.status === 'DRAFT';
              return (
                <li key={v.id} className={`px-4 py-3 ${i > 0 ? 'dotted-divider' : ''}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{v.address}</span>
                    <StatusChip status={v.status} />
                  </div>
                  <p className="mt-1 text-xs text-stone">
                    {v.agent.name} · {v.prospectName} · {date}, <span className="tnum">{time}</span>
                    {waiting && (
                      <>
                        {' '}
                        · {t.admin.waiting} {formatWaiting(v.visitDatetime)}
                      </>
                    )}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>

        <p className="text-xs text-stone">
          {t.admin.inbox}: <span className="tnum font-medium">{inboxCount}</span> — {t.admin.inboxNote}
        </p>
      </div>
    </main>
  );
}
