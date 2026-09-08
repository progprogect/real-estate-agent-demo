import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { t } from '@/lib/strings';
import { AdminPageHeader } from '@/components/ui';
import { CriterionEditor, NewCriterionForm } from './CriterionEditor';

export const dynamic = 'force-dynamic';

export default async function CriteriaPage() {
  const session = await getSession();
  if (!session.userId) redirect('/login');
  if (session.role !== 'ADMIN') redirect('/visits');

  const criteria = await prisma.criterionConfig.findMany({ orderBy: { sortOrder: 'asc' } });

  return (
    <main className="pb-12">
      <AdminPageHeader title={t.criteria.title} subtitle={t.criteria.subtitle} />

      <div className="space-y-4 px-5">
        {criteria.length === 0 && (
          <p className="text-sm text-stone">{t.criteria.empty}</p>
        )}

        {criteria.map((c, i) => (
          <CriterionEditor
            key={c.id}
            criterion={{
              id: c.id,
              key: c.key,
              label: c.label,
              hint: c.hint,
              type: c.type,
              options: c.options,
              ratingMax: c.ratingMax,
              active: c.active,
            }}
            isFirst={i === 0}
            isLast={i === criteria.length - 1}
          />
        ))}

        <NewCriterionForm />
      </div>
    </main>
  );
}
