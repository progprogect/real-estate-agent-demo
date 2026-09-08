import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { analyzeField, analyzeGeneral, transcribe, type CriterionDef, type ExistingField } from '@/lib/ai';
import { getOutputLanguage } from '@/lib/settings';
import type { AnalyzeResponse, CriterionType, DraftValues } from '@/lib/types';

export const maxDuration = 120;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const visit = await prisma.visit.findUnique({
    where: { id },
    include: { draft: true, recordings: { orderBy: { index: 'asc' } } },
  });
  if (!visit || visit.agentId !== session.userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const form = await req.formData();
  const audio = form.get('audio');
  const mode = String(form.get('mode') ?? 'general');
  const fieldKey = form.get('fieldKey') ? String(form.get('fieldKey')) : null;
  const durationS = Number(form.get('durationS') ?? 0) || 0;
  if (!(audio instanceof Blob)) {
    return NextResponse.json({ error: 'Missing audio' }, { status: 400 });
  }

  const rows = await prisma.criterionConfig.findMany({
    where: { active: true },
    orderBy: { sortOrder: 'asc' },
  });
  const criteria: CriterionDef[] = rows.map((c) => ({
    key: c.key,
    label: c.label,
    hint: c.hint,
    type: c.type as CriterionType,
    options: c.options,
    ratingMax: c.ratingMax,
  }));

  const currentValues = (visit.draft?.values as DraftValues) ?? {};
  const existing: Record<string, ExistingField> = {};
  for (const c of criteria) {
    existing[c.key] = {
      value: currentValues[c.key]?.value ?? '',
      confirmed: currentValues[c.key]?.confirmed ?? false,
    };
  }

  const language = await getOutputLanguage();
  const buffer = Buffer.from(await audio.arrayBuffer());

  try {
    const verbatim = await transcribe(buffer, 'wav');
    const nextIndex = (visit.recordings.at(-1)?.index ?? 0) + 1;

    const take = await prisma.recording.create({
      data: {
        visitId: visit.id,
        index: nextIndex,
        mode: mode === 'field' ? 'field' : 'general',
        fieldKey: mode === 'field' ? fieldKey : null,
        verbatim,
        durationS,
      },
    });
    const takeView = {
      index: take.index,
      mode: take.mode,
      fieldKey: take.fieldKey,
      durationS: take.durationS,
      verbatim: take.verbatim,
    };

    if (mode === 'field') {
      const criterion = criteria.find((c) => c.key === fieldKey);
      if (!criterion) return NextResponse.json({ error: 'Unknown field' }, { status: 400 });
      const field = await analyzeField(
        verbatim,
        criterion,
        existing[criterion.key]?.value ?? '',
        language
      );
      const response: AnalyzeResponse = {
        mode: 'field',
        take: takeView,
        fieldKey: criterion.key,
        field,
      };
      return NextResponse.json(response);
    }

    // Every general take sees the whole conversation so far, so a second one
    // can extend or correct what the first produced instead of replacing it.
    const fullVerbatim = [...visit.recordings.map((r) => r.verbatim), verbatim]
      .filter(Boolean)
      .join('\n\n');

    const { fields, generalFeedback } = await analyzeGeneral(
      fullVerbatim,
      criteria,
      existing,
      language
    );
    const response: AnalyzeResponse = {
      mode: 'general',
      take: takeView,
      verbatim: fullVerbatim,
      generalFeedback,
      fields,
    };
    return NextResponse.json(response);
  } catch (err) {
    console.error('[analyze] failed:', err);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 502 });
  }
}
