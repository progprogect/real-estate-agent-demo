import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { analyzeField, analyzeGeneral, transcribe } from '@/lib/ai';
import type { AnalyzeResponse } from '@/lib/types';

export const maxDuration = 60;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const visit = await prisma.visit.findUnique({ where: { id } });
  if (!visit || visit.agentId !== session.userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const form = await req.formData();
  const audio = form.get('audio');
  const mode = String(form.get('mode') ?? 'general');
  const fieldKey = form.get('fieldKey') ? String(form.get('fieldKey')) : null;
  if (!(audio instanceof Blob)) {
    return NextResponse.json({ error: 'Missing audio' }, { status: 400 });
  }

  const buffer = Buffer.from(await audio.arrayBuffer());
  const criteria = await prisma.criterionConfig.findMany({
    where: { active: true },
    orderBy: { sortOrder: 'asc' },
    select: { key: true, label: true, hint: true },
  });

  try {
    const verbatim = await transcribe(buffer, 'wav');

    if (mode === 'field') {
      const criterion = criteria.find((c) => c.key === fieldKey);
      if (!criterion) return NextResponse.json({ error: 'Unknown field' }, { status: 400 });
      const field = await analyzeField(verbatim, criterion);
      const response: AnalyzeResponse = { mode: 'field', fieldKey: criterion.key, field };
      return NextResponse.json(response);
    }

    const { fields, generalFeedback } = await analyzeGeneral(verbatim, criteria);
    const response: AnalyzeResponse = { mode: 'general', verbatim, generalFeedback, fields };
    return NextResponse.json(response);
  } catch (err) {
    console.error('[analyze] failed:', err);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 502 });
  }
}
