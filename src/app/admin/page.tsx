import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { t } from '@/lib/strings';
import { formatVisitTime, formatWaiting } from '@/lib/format';
import { AppHeader } from '@/components/AppHeader';
import { StatusChip } from '@/components/StatusChip';
import { ResetDemoButton } from '@/components/ResetDemoButton';

export const dynamic = 'force-dynamic';

const OPEN_STATUSES = ['PENDING', 'REMINDER_SENT', 'DRAFT'];

const sections = [
  { href: '/admin/criteria', label: t.nav.criteria, description: t.criteria.subtitle },
  { href: '/admin/viewings', label: t.nav.viewings, description: t.viewings.subtitle },
  { href: '/admin/people', label: t.nav.people, description: t.people.subtitle },
  { href: '/admin/zoho', label: t.zoho.title, description: t.zoho.subtitle },
  { href: '/admin/settings', label: t.nav.settings, description: t.settings.subtitle },
];

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
      include: { agent: { select: { name: true, branch: true } } },
    }),
    prisma.submission.findMany({
      where: { status: 'FAILED' },
      include: { visit: { select: { address: true, agent: { select: { name: true } } } } },
      orderBy: { submittedAt: 'desc' },
    }),
    prisma.inboxEvent.count(),
  ]);

  const rate = (list: typeof visits) => {
    const answered = list.filter((v) => v.status === 'ANSWERED').length;
    const answerable = list.filter((v) => v.status !== 'CANCELLED').length;
    return {
      answered,
      pending: list.filter((v) => OPEN_STATUSES.includes(v.status)).length,
      rate: answerable === 0 ? 0 : Math.round((answered / answerable) * 100),
    };
  };

  const perAgent = agents.map((a) => ({
    ...a,
    ...rate(visits.filter((v) => v.agentId === a.id)),
  }));

  const branches = [...new Set(agents.map((a) => a.branch).filter(Boolean))] as string[];
  const perBranch = branches.map((branch) => ({
    branch,
    ...rate(visits.filter((v) => v.agent.branch === branch)),
  }));

  return (
    <main className="pb-12">
      <AppHeader userName={session.name ?? ''} isAdmin currentView="admin" />

      <div className="px-5">
        <h1 className="mb-1 mt-2 font-display text-3xl font-semibold">{t.admin.title}</h1>
        <p className="mb-5 text-sm text-stone">{t.admin.subtitle}</p>

        {/* Configuration entry points */}
        <nav className="mb-5 grid gap-2">
          {sections.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="rounded-card border border-line bg-surface px-4 py-3 active:bg-paper"
            >
              <span className="block text-[15px] font-medium">{s.label}</span>
              <span className="mt-0.5 block text-xs text-stone">{s.description}</span>
            </Link>
          ))}
        </nav>

        {/* Branches */}
        {perBranch.length > 0 && (
          <section className="mb-5">
            <p className="overline-label mb-2">{t.admin.branch}</p>
            <div className="overflow-hidden rounded-card border border-line bg-surface">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-stone">
                    <th className="px-4 py-2.5 font-medium">{t.admin.branch}</th>
                    <th className="px-2 py-2.5 text-right font-medium">{t.admin.pending}</th>
                    <th className="px-2 py-2.5 text-right font-medium">{t.admin.answeredCol}</th>
                    <th className="px-4 py-2.5 text-right font-medium">{t.admin.responseRate}</th>
                  </tr>
                </thead>
                <tbody>
                  {perBranch.map((b) => (
                    <tr key={b.branch} className="dotted-divider">
                      <td className="px-4 py-3 font-medium">{b.branch}</td>
                      <td className="tnum px-2 py-3 text-right">{b.pending}</td>
                      <td className="tnum px-2 py-3 text-right">{b.answered}</td>
                      <td className="tnum px-4 py-3 text-right font-display font-semibold">
                        {b.rate}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

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
              const waiting = OPEN_STATUSES.includes(v.status);
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

        <p className="mb-5 text-xs text-stone">
          {t.admin.inbox}: <span className="tnum font-medium">{inboxCount}</span> — {t.admin.inboxNote}
        </p>

        <ResetDemoButton />
      </div>
    </main>
  );
}
