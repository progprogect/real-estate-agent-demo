import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Mock of the agency's single feedback endpoint (in production this lives on
 * the agency's side and distributes data into Zoho). It validates the bearer
 * token and enforces idempotency, mirroring the contract in the brief.
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${process.env.FEEDBACK_ENDPOINT_TOKEN ?? ''}`;
  if (!process.env.FEEDBACK_ENDPOINT_TOKEN || auth !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = (await req.json()) as { idempotency_key?: string };
  const key = payload.idempotency_key;
  if (!key) {
    return NextResponse.json({ error: 'Missing idempotency_key' }, { status: 400 });
  }

  const existing = await prisma.inboxEvent.findUnique({ where: { idempotencyKey: key } });
  if (existing) {
    return NextResponse.json({ error: 'Duplicate submission' }, { status: 409 });
  }

  await prisma.inboxEvent.create({ data: { idempotencyKey: key, payload } });
  return NextResponse.json({ ok: true });
}
