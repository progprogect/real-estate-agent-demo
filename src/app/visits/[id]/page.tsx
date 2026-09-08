import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { FeedbackScreen } from './FeedbackScreen';
import type { DraftValues } from '@/lib/types';

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
    include: { draft: true },
  });

  // Strict per-agent isolation: an agent never sees another agent's data.
  if (!visit || visit.agentId !== session.userId) notFound();
  if (visit.status === 'ANSWERED' || visit.status === 'CANCELLED') redirect('/visits');

  const criteria = await prisma.criterionConfig.findMany({
    where: { active: true },
    orderBy: { sortOrder: 'asc' },
    select: { key: true, label: true, hint: true },
  });

  return (
    <FeedbackScreen
      visitId={visit.id}
      address={visit.address}
      prospectName={visit.prospectName}
      visitDatetimeIso={visit.visitDatetime.toISOString()}
      criteria={criteria}
      initialValues={(visit.draft?.values as DraftValues) ?? {}}
      initialGeneralFeedback={visit.draft?.generalFeedback ?? ''}
      initialVerbatim={visit.draft?.verbatim ?? ''}
    />
  );
}
