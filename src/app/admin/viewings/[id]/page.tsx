import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { t } from '@/lib/strings';
import { FeedbackSummary } from '@/components/FeedbackSummary';
import type { CriterionType, DraftValues } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function AdminViewingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session.userId) redirect('/login');
  if (session.role !== 'ADMIN') redirect('/visits');

  const { id } = await params;
  const visit = await prisma.visit.findUnique({
    where: { id },
    include: {
      draft: true,
      submission: true,
      recordings: { orderBy: { index: 'asc' } },
      agent: { select: { name: true } },
    },
  });
  if (!visit) notFound();

  // Reading one agent's feedback is an audited action (GDPR, brief section 8).
  await prisma.auditLog.create({
    data: {
      userId: session.userId,
      action: 'admin.view_feedback',
      detail: `${visit.zohoEventId} · ${visit.address}`,
    },
  });

  const criteria = await prisma.criterionConfig.findMany({ orderBy: { sortOrder: 'asc' } });
  const values = (visit.draft?.values as DraftValues) ?? {};

  return (
    <main className="pb-12">
      <header className="px-5 pb-4 pt-5">
        <Link href="/admin/viewings" className="text-sm text-pine underline underline-offset-2">
          ← {t.nav.viewings}
        </Link>
        <h1 className="mt-3 font-display text-2xl font-semibold">{t.summary.title}</h1>
      </header>

      <div className="px-5">
        {visit.draft ? (
          <>
            {visit.status !== 'ANSWERED' && (
              <p className="mb-4 rounded-card border border-line bg-amber-soft/40 px-4 py-3 text-sm">
                {t.summary.draftInProgress}
              </p>
            )}
            <FeedbackSummary
              showPayload
              criteria={criteria
                .filter((c) => c.key in values)
                .map((c) => ({
                  key: c.key,
                  label: c.label,
                  type: c.type as CriterionType,
                  ratingMax: c.ratingMax,
                }))}
              visit={{
                status: visit.status,
                address: visit.address,
                prospectName: visit.prospectName,
                propertyRef: visit.propertyRef,
                visitDatetime: visit.visitDatetime,
                agentName: visit.agent.name,
                values,
                generalFeedback: visit.draft.generalFeedback,
                verbatim: visit.draft.verbatim,
                takes: visit.recordings.map((r) => ({
                  index: r.index,
                  mode: r.mode,
                  fieldKey: r.fieldKey,
                  durationS: r.durationS,
                })),
                submission: visit.submission,
              }}
            />
          </>
        ) : (
          <p className="text-sm text-stone">{t.summary.notSubmitted}</p>
        )}
      </div>
    </main>
  );
}
