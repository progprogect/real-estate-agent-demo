import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { t } from '@/lib/strings';
import { FeedbackScreen } from './FeedbackScreen';
import { FeedbackSummary } from '@/components/FeedbackSummary';
import type { CriterionType, DraftValues } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function VisitFeedbackPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session.userId) redirect('/login');

  const { id } = await params;
  const visit = await prisma.visit.findUnique({
    where: { id },
    include: {
      draft: true,
      submission: true,
      recordings: { orderBy: { index: 'asc' } },
    },
  });

  // Strict per-agent isolation: an agent never sees another agent's data.
  if (!visit || visit.agentId !== session.userId) notFound();

  const criteria = await prisma.criterionConfig.findMany({
    orderBy: { sortOrder: 'asc' },
  });
  const criteriaView = criteria.map((c) => ({
    key: c.key,
    label: c.label,
    hint: c.hint,
    type: c.type as CriterionType,
    options: c.options,
    ratingMax: c.ratingMax,
  }));

  // Once submitted, the viewing is read-only: the agent can look back at what
  // was sent, but it is never offered for feedback again.
  if (visit.status === 'ANSWERED' || visit.status === 'EXPIRED' || visit.status === 'CANCELLED') {
    return (
      <main className="pb-12">
        <header className="px-5 pb-4 pt-5">
          <Link href="/visits" className="text-sm text-pine underline underline-offset-2">
            ← {t.feedback.backToList}
          </Link>
          <h1 className="mt-3 font-display text-2xl font-semibold">{t.summary.agentTitle}</h1>
        </header>
        <div className="px-5">
          {visit.draft ? (
            <FeedbackSummary
              criteria={criteriaView.filter((c) => visit.draft?.values && c.key in (visit.draft.values as DraftValues))}
              visit={{
                status: visit.status,
                address: visit.address,
                prospectName: visit.prospectName,
                propertyRef: visit.propertyRef,
                visitDatetime: visit.visitDatetime,
                values: visit.draft.values as DraftValues,
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
          ) : (
            <p className="text-sm text-stone">{t.summary.notSubmitted}</p>
          )}
        </div>
      </main>
    );
  }

  return (
    <FeedbackScreen
      visitId={visit.id}
      address={visit.address}
      prospectName={visit.prospectName}
      visitDatetimeIso={visit.visitDatetime.toISOString()}
      criteria={criteriaView.filter((_, i) => criteria[i].active)}
      initialValues={(visit.draft?.values as DraftValues) ?? {}}
      initialGeneralFeedback={visit.draft?.generalFeedback ?? ''}
      initialVerbatim={visit.draft?.verbatim ?? ''}
      initialTakes={visit.recordings.map((r) => ({
        index: r.index,
        mode: r.mode,
        fieldKey: r.fieldKey,
        durationS: r.durationS,
        verbatim: r.verbatim,
      }))}
    />
  );
}
