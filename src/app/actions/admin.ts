'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { demoVisits, visitDatetimeFor } from '@/lib/demo-data';

/**
 * Puts the demo back to its starting point: clears every feedback draft,
 * submission and endpoint delivery, then restores the viewings with times
 * relative to now, so the app can be demonstrated any number of times.
 */
export async function resetDemoData() {
  const session = await getSession();
  if (!session.userId || session.role !== 'ADMIN') return;

  const agents = await prisma.user.findMany({ select: { id: true, email: true } });
  const agentIdByEmail = new Map(agents.map((a) => [a.email, a.id]));
  const now = new Date();

  await prisma.$transaction([
    prisma.submission.deleteMany(),
    prisma.feedbackDraft.deleteMany(),
    prisma.inboxEvent.deleteMany(),
    ...demoVisits.flatMap((v) => {
      const agentId = agentIdByEmail.get(v.agentEmail);
      if (!agentId) return [];
      const data = {
        zohoDealId: `zd-${v.zohoEventId.slice(3)}`,
        zohoContactId: `zc-${v.zohoEventId.slice(3)}`,
        propertyRef: v.propertyRef,
        address: v.address,
        prospectName: v.prospectName,
        visitDatetime: visitDatetimeFor(v, now),
        status: v.status,
        agentId,
      };
      return [
        prisma.visit.upsert({
          where: { zohoEventId: v.zohoEventId },
          update: data,
          create: { zohoEventId: v.zohoEventId, ...data },
        }),
      ];
    }),
  ]);

  await prisma.auditLog.create({
    data: { userId: session.userId, action: 'admin.reset_demo', detail: 'Reset demo data' },
  });

  revalidatePath('/admin');
  revalidatePath('/visits');
}
