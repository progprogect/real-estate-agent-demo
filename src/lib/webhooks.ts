/**
 * Outbound signals to the agency's reminder engine (brief, package 7).
 * We never send the reminders ourselves — we tell them when a viewing changes
 * state, and every attempt is logged so failures stay visible in the admin view.
 */

import { prisma } from '@/lib/db';
import { SETTINGS, getSettings, numberSetting } from '@/lib/settings';

export type WebhookType =
  | 'feedback_due'
  | 'feedback_reminder'
  | 'feedback_received'
  | 'feedback_expired';

type VisitForWebhook = {
  id: string;
  zohoEventId: string;
  propertyRef: string;
  address: string;
  prospectName: string;
  visitDatetime: Date;
  agent: { email: string; zohoUserId: string | null };
};

export async function sendWebhook(
  type: WebhookType,
  visit: VisitForWebhook,
  extra: Record<string, unknown> = {}
): Promise<void> {
  const settings = await getSettings();
  const url = settings[SETTINGS.webhookUrl]?.trim();
  const token = settings[SETTINGS.webhookToken]?.trim();

  const payload = {
    type,
    sent_at: new Date().toISOString(),
    visit: {
      zoho_event_id: visit.zohoEventId,
      property_ref: visit.propertyRef,
      address: visit.address,
      prospect: visit.prospectName,
      visit_datetime: visit.visitDatetime.toISOString(),
    },
    agent: { email: visit.agent.email, zoho_user_id: visit.agent.zohoUserId },
    ...extra,
  };

  if (!url) {
    // Nothing configured yet: still record what would have gone out, so the
    // contract is demonstrable before the agency hands over their endpoint.
    await prisma.webhookEvent.create({
      data: { visitId: visit.id, type, payload, status: 'not_configured' },
    });
    return;
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    await prisma.webhookEvent.create({
      data: {
        visitId: visit.id,
        type,
        payload,
        status: res.ok ? 'delivered' : 'failed',
        responseCode: res.status,
        error: res.ok ? null : (await res.text()).slice(0, 500),
      },
    });
  } catch (err) {
    await prisma.webhookEvent.create({
      data: {
        visitId: visit.id,
        type,
        payload,
        status: 'failed',
        error: err instanceof Error ? err.message.slice(0, 500) : 'Network error',
      },
    });
  }
}

/**
 * Advances every open viewing through the state machine: due once the viewing
 * has ended, reminders after the configured delays, expiry after the deadline.
 * Idempotent, so it is safe to run on a schedule and on demand.
 */
export async function runStateCheck(): Promise<{
  due: number;
  reminded: number;
  expired: number;
}> {
  const settings = await getSettings();
  const firstHours = numberSetting(settings, SETTINGS.reminderFirstHours);
  const secondHours = numberSetting(settings, SETTINGS.reminderSecondHours);
  const expiryDays = numberSetting(settings, SETTINGS.expiryDays);

  const now = new Date();
  const open = await prisma.visit.findMany({
    where: { status: { in: ['PENDING', 'REMINDER_SENT', 'DRAFT'] } },
    include: { agent: { select: { email: true, zohoUserId: true } } },
  });

  let due = 0;
  let reminded = 0;
  let expired = 0;

  for (const visit of open) {
    const hoursSince = (now.getTime() - visit.visitDatetime.getTime()) / 3600_000;
    if (hoursSince < 0) continue; // viewing has not happened yet

    if (hoursSince >= expiryDays * 24) {
      await prisma.visit.update({ where: { id: visit.id }, data: { status: 'EXPIRED' } });
      await sendWebhook('feedback_expired', visit, { waited_hours: Math.round(hoursSince) });
      expired++;
      continue;
    }

    if (!visit.dueEventSentAt) {
      await prisma.visit.update({
        where: { id: visit.id },
        data: { dueEventSentAt: now },
      });
      await sendWebhook('feedback_due', visit);
      due++;
    }

    const remindersOwed =
      hoursSince >= secondHours ? 2 : hoursSince >= firstHours ? 1 : 0;
    if (remindersOwed > visit.remindersSent) {
      await prisma.visit.update({
        where: { id: visit.id },
        data: {
          remindersSent: remindersOwed,
          status: visit.status === 'PENDING' ? 'REMINDER_SENT' : visit.status,
        },
      });
      await sendWebhook('feedback_reminder', visit, {
        reminder_number: remindersOwed,
        waited_hours: Math.round(hoursSince),
      });
      reminded++;
    }
  }

  return { due, reminded, expired };
}
