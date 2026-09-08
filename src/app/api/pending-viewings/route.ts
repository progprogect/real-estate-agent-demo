import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * The read API the brief offers as an alternative to outbound webhooks
 * (package 7): everything still waiting for feedback, for the agency's
 * reminder engine to poll.
 */
export async function GET(req: NextRequest) {
  const token = process.env.FEEDBACK_ENDPOINT_TOKEN ?? '';
  if (!token || req.headers.get('authorization') !== `Bearer ${token}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const visits = await prisma.visit.findMany({
    where: { status: { in: ['PENDING', 'REMINDER_SENT', 'DRAFT'] } },
    orderBy: { visitDatetime: 'asc' },
    include: { agent: { select: { email: true, zohoUserId: true } } },
  });

  const now = Date.now();
  return NextResponse.json({
    count: visits.length,
    viewings: visits.map((v) => ({
      zoho_event_id: v.zohoEventId,
      property_ref: v.propertyRef,
      address: v.address,
      prospect: v.prospectName,
      visit_datetime: v.visitDatetime.toISOString(),
      status: v.status.toLowerCase(),
      reminders_sent: v.remindersSent,
      waiting_hours: Math.max(0, Math.round((now - v.visitDatetime.getTime()) / 3600_000)),
      agent: { email: v.agent.email, zoho_user_id: v.agent.zohoUserId },
    })),
  });
}
