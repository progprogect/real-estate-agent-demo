import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import type { DraftValues } from '@/lib/types';

export const maxDuration = 60;

const MAX_ATTEMPTS = 3;

/**
 * Builds the payload defined by the agency's endpoint contract and delivers it
 * with retries and an idempotency key. The endpoint itself is mocked in this
 * demo (/api/agent-feedback) but the contract matches the brief verbatim.
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const visit = await prisma.visit.findUnique({
    where: { id },
    include: { draft: true, agent: true, submission: true },
  });
  if (!visit || visit.agentId !== session.userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (visit.status === 'ANSWERED') {
    return NextResponse.json({ ok: true, alreadySubmitted: true });
  }
  if (!visit.draft) {
    return NextResponse.json({ error: 'Nothing to submit' }, { status: 400 });
  }

  const values = visit.draft.values as DraftValues;
  const attemptNumber = (visit.submission?.attempts ?? 0) + 1;
  // Stable per visit so a replayed submission is rejected as a duplicate,
  // matching the "visit_<ref>-<n>" shape from the contract example.
  const idempotencyKey = visit.submission?.idempotencyKey ?? `visit_${visit.zohoEventId}-1`;

  const payload = {
    idempotency_key: idempotencyKey,
    visit: {
      zoho_event_id: visit.zohoEventId,
      zoho_deal_id: visit.zohoDealId,
      zoho_contact_id: visit.zohoContactId,
      property_ref: visit.propertyRef,
      visit_datetime: visit.visitDatetime.toISOString(),
    },
    agent: { email: visit.agent.email, zoho_user_id: visit.agent.zohoUserId },
    submitted_at: new Date().toISOString(),
    input_mode: visit.draft.inputMode,
    criteria: Object.entries(values).map(([key, v]) => ({
      key,
      value: v.value,
      answered: v.value.trim().length > 0,
      edited_by_agent: v.editedByAgent,
    })),
    general_feedback: visit.draft.generalFeedback,
    verbatim: visit.draft.verbatim,
    audio: {
      duration_s: visit.draft.audioDurationS,
      storage_path: `audio/${visit.visitDatetime.getFullYear()}/${String(visit.visitDatetime.getMonth() + 1).padStart(2, '0')}/visit_${visit.zohoEventId}.wav`,
    },
    app_version: '0.1.0-demo',
  };

  const submission = await prisma.submission.upsert({
    where: { visitId: id },
    update: { payload, attempts: attemptNumber, status: 'PENDING' },
    create: { visitId: id, idempotencyKey, payload, attempts: 1 },
  });

  const endpointUrl =
    process.env.FEEDBACK_ENDPOINT_URL ??
    (process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/api/agent-feedback`
      : `http://localhost:${process.env.PORT ?? 3000}/api/agent-feedback`);
  const token = process.env.FEEDBACK_ENDPOINT_TOKEN ?? '';

  let lastError = '';
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      // 409 = duplicate idempotency key: already delivered, treat as success.
      if (res.ok || res.status === 409) {
        await prisma.$transaction([
          prisma.submission.update({
            where: { id: submission.id },
            data: { status: 'DELIVERED', deliveredAt: new Date(), lastError: null },
          }),
          prisma.visit.update({ where: { id }, data: { status: 'ANSWERED' } }),
        ]);
        return NextResponse.json({ ok: true });
      }
      lastError = `Endpoint returned ${res.status}`;
      if (res.status < 500) break; // client errors will not heal on retry
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Network error';
    }
    // Increasing delay between retries: 1s, 2s.
    if (attempt < MAX_ATTEMPTS - 1) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }

  await prisma.submission.update({
    where: { id: submission.id },
    data: { status: 'FAILED', lastError },
  });
  return NextResponse.json({ error: lastError }, { status: 502 });
}
