import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { t } from '@/lib/strings';
import { AdminPageHeader } from '@/components/ui';
import { PeopleManager } from './PeopleManager';

export const dynamic = 'force-dynamic';

export default async function PeoplePage() {
  const session = await getSession();
  if (!session.userId) redirect('/login');
  if (session.role !== 'ADMIN') redirect('/visits');

  const people = await prisma.user.findMany({
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      email: true,
      branch: true,
      role: true,
      zohoUserId: true,
      _count: { select: { visits: true } },
    },
  });

  return (
    <main className="pb-12">
      <AdminPageHeader title={t.people.title} subtitle={t.people.subtitle} />
      <div className="px-5">
        <PeopleManager
          people={people.map((p) => ({
            id: p.id,
            name: p.name,
            email: p.email,
            branch: p.branch,
            role: p.role,
            zohoUserId: p.zohoUserId,
            visits: p._count.visits,
          }))}
        />
      </div>
    </main>
  );
}
