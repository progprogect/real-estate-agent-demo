import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { t } from '@/lib/strings';
import { formatVisitTime, formatWaiting } from '@/lib/format';
import { AppHeader } from '@/components/AppHeader';
import { StatusChip } from '@/components/StatusChip';

export const dynamic = 'force-dynamic';

type Tab = 'todo' | 'done' | 'expired';

export default async function VisitsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getSession();
  if (!session.userId) redirect('/login');

  const { tab: rawTab } = await searchParams;
  const tab: Tab = rawTab === 'done' || rawTab === 'expired' ? rawTab : 'todo';

  const visits = await prisma.visit.findMany({
    where: { agentId: session.userId },
    orderBy: { visitDatetime: 'desc' },
  });

  const groups: Record<Tab, typeof visits> = {
    todo: visits.filter(
      (v) => v.status === 'PENDING' || v.status === 'REMINDER_SENT' || v.status === 'DRAFT'
    ),
    done: visits.filter((v) => v.status === 'ANSWERED'),
    expired: visits.filter((v) => v.status === 'EXPIRED' || v.status === 'CANCELLED'),
  };

  const emptyCopy: Record<Tab, string> = {
    todo: t.visits.emptyTodo,
    done: t.visits.emptyDone,
    expired: t.visits.emptyExpired,
  };

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'todo', label: t.visits.todo, count: groups.todo.length },
    { id: 'done', label: t.visits.done, count: groups.done.length },
    { id: 'expired', label: t.visits.expired, count: groups.expired.length },
  ];

  return (
    <main className="pb-10">
      <AppHeader
        userName={session.name ?? ''}
        isAdmin={session.role === 'ADMIN'}
        currentView="agent"
      />

      <div className="px-5">
        <h1 className="mb-4 mt-2 font-display text-3xl font-semibold">{t.visits.title}</h1>

        <nav className="mb-4 flex gap-2">
          {tabs.map(({ id, label, count }) => (
            <Link
              key={id}
              href={`/visits?tab=${id}`}
              className={`rounded-chip border px-3 py-2 text-sm font-medium ${
                tab === id
                  ? 'border-ink bg-ink text-paper'
                  : 'border-line bg-surface text-ink'
              }`}
            >
              {label} <span className="tnum">({count})</span>
            </Link>
          ))}
        </nav>

        {groups[tab].length === 0 ? (
          <p className="mt-10 text-center text-sm text-stone">{emptyCopy[tab]}</p>
        ) : (
          <ul className="overflow-hidden rounded-card border border-line bg-surface">
            {groups[tab].map((v, i) => {
              const { time, date } = formatVisitTime(v.visitDatetime);
              // Done and expired rows open a read-only record of what was sent.
              const clickable = v.status !== 'CANCELLED';
              const row = (
                <div className={`flex items-center gap-4 px-4 py-3.5 ${i > 0 ? 'dotted-divider' : ''}`}>
                  <div className="w-14 shrink-0 text-center">
                    <div className="font-display text-lg font-semibold tnum leading-tight">{time}</div>
                    <div className="text-xs text-stone">{date}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-medium">{v.address}</div>
                    <div className="truncate text-sm text-stone">
                      {v.prospectName}
                      {v.status === 'PENDING' || v.status === 'DRAFT' ? (
                        <> · {t.visits.pendingFor(formatWaiting(v.visitDatetime))}</>
                      ) : v.status === 'CANCELLED' ? (
                        <> · {t.visits.cancelled}</>
                      ) : v.status === 'EXPIRED' ? (
                        <> · {t.visits.expiredNote}</>
                      ) : null}
                    </div>
                  </div>
                  <StatusChip
                    status={v.status}
                    label={v.status === 'DRAFT' ? t.visits.draftChip : undefined}
                  />
                </div>
              );
              return (
                <li key={v.id}>
                  {clickable ? (
                    <Link href={`/visits/${v.id}`} className="block active:bg-paper">
                      {row}
                    </Link>
                  ) : (
                    row
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
