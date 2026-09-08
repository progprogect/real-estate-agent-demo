import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';

const draftSchema = z.object({
  values: z.record(
    z.string(),
    z.object({
      value: z.string(),
      state: z.enum(['filled', 'incomplete', 'missing']),
      confirmed: z.boolean(),
      editedByAgent: z.boolean(),
    })
  ),
  generalFeedback: z.string(),
  verbatim: z.string(),
  audioDurationS: z.number().int().min(0).optional(),
});

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const visit = await prisma.visit.findUnique({ where: { id } });
  if (!visit || visit.agentId !== session.userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (visit.status === 'ANSWERED' || visit.status === 'CANCELLED') {
    return NextResponse.json({ error: 'Visit is closed' }, { status: 409 });
  }

  const parsed = draftSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid draft' }, { status: 400 });
  }
  const { values, generalFeedback, verbatim, audioDurationS } = parsed.data;

  await prisma.$transaction([
    prisma.feedbackDraft.upsert({
      where: { visitId: id },
      update: { values, generalFeedback, verbatim, audioDurationS: audioDurationS ?? 0 },
      create: {
        visitId: id,
        values,
        generalFeedback,
        verbatim,
        audioDurationS: audioDurationS ?? 0,
      },
    }),
    prisma.visit.update({
      where: { id },
      data: { status: visit.status === 'PENDING' ? 'DRAFT' : visit.status },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
