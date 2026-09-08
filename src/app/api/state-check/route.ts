import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { runStateCheck } from '@/lib/webhooks';

export const maxDuration = 60;

/**
 * Advances the viewing state machine. Meant to be hit on a schedule (Railway
 * cron or the agency's own scheduler) with the endpoint token, and reachable
 * by an administrator from the network view.
 */
export async function POST(req: NextRequest) {
  const token = process.env.FEEDBACK_ENDPOINT_TOKEN ?? '';
  const authorized =
    (token && req.headers.get('authorization') === `Bearer ${token}`) ||
    (await getSession()).role === 'ADMIN';

  if (!authorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await runStateCheck();
  return NextResponse.json({ ok: true, ...result });
}
