'use server';

import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { SETTINGS, setSetting } from '@/lib/settings';
import { runStateCheck } from '@/lib/webhooks';

async function requireAdmin() {
  const session = await getSession();
  if (!session.userId || session.role !== 'ADMIN') return null;
  return session;
}

function slugify(label: string): string {
  return (
    label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'criterion'
  );
}

// ---------------------------------------------------------------------------
// Feedback fields
// ---------------------------------------------------------------------------

function readCriterionForm(formData: FormData) {
  const label = String(formData.get('label') ?? '').trim();
  const hint = String(formData.get('hint') ?? '').trim();
  const type = String(formData.get('type') ?? 'text');
  const ratingMax = Math.min(10, Math.max(2, Number(formData.get('ratingMax') ?? 5) || 5));
  const options = String(formData.get('options') ?? '')
    .split('\n')
    .map((o) => o.trim())
    .filter(Boolean);
  return { label, hint, type, ratingMax, options };
}

export async function createCriterion(formData: FormData) {
  if (!(await requireAdmin())) return;
  const { label, hint, type, ratingMax, options } = readCriterionForm(formData);
  if (!label) return;
  if (type === 'choice' && options.length < 2) return;

  // The key travels to the agency endpoint, so it is derived once and then
  // frozen; a collision gets a numeric suffix rather than overwriting.
  const base = slugify(label);
  let key = base;
  for (let n = 2; await prisma.criterionConfig.findUnique({ where: { key } }); n++) {
    key = `${base}_${n}`;
  }

  const last = await prisma.criterionConfig.findFirst({ orderBy: { sortOrder: 'desc' } });
  await prisma.criterionConfig.create({
    data: {
      key,
      label,
      hint,
      type,
      ratingMax,
      options: type === 'choice' ? options : [],
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });
  revalidatePath('/admin/criteria');
}

export async function updateCriterion(formData: FormData) {
  if (!(await requireAdmin())) return;
  const id = String(formData.get('id') ?? '');
  const { label, hint, type, ratingMax, options } = readCriterionForm(formData);
  if (!id || !label) return;
  if (type === 'choice' && options.length < 2) return;

  await prisma.criterionConfig.update({
    where: { id },
    data: { label, hint, type, ratingMax, options: type === 'choice' ? options : [] },
  });
  revalidatePath('/admin/criteria');
}

export async function toggleCriterion(formData: FormData) {
  if (!(await requireAdmin())) return;
  const id = String(formData.get('id') ?? '');
  const criterion = await prisma.criterionConfig.findUnique({ where: { id } });
  if (!criterion) return;
  await prisma.criterionConfig.update({
    where: { id },
    data: { active: !criterion.active },
  });
  revalidatePath('/admin/criteria');
}

export async function moveCriterion(formData: FormData) {
  if (!(await requireAdmin())) return;
  const id = String(formData.get('id') ?? '');
  const direction = String(formData.get('direction') ?? 'up');
  const all = await prisma.criterionConfig.findMany({ orderBy: { sortOrder: 'asc' } });
  const index = all.findIndex((c) => c.id === id);
  const swapWith = direction === 'up' ? index - 1 : index + 1;
  if (index === -1 || swapWith < 0 || swapWith >= all.length) return;

  await prisma.$transaction([
    prisma.criterionConfig.update({
      where: { id: all[index].id },
      data: { sortOrder: all[swapWith].sortOrder },
    }),
    prisma.criterionConfig.update({
      where: { id: all[swapWith].id },
      data: { sortOrder: all[index].sortOrder },
    }),
  ]);
  revalidatePath('/admin/criteria');
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function saveSettings(formData: FormData) {
  if (!(await requireAdmin())) return;
  const entries: [string, string][] = [
    [SETTINGS.outputLanguage, String(formData.get('outputLanguage') ?? 'auto')],
    [SETTINGS.reminderFirstHours, String(formData.get('reminderFirstHours') ?? '4')],
    [SETTINGS.reminderSecondHours, String(formData.get('reminderSecondHours') ?? '24')],
    [SETTINGS.expiryDays, String(formData.get('expiryDays') ?? '7')],
    [SETTINGS.webhookUrl, String(formData.get('webhookUrl') ?? '').trim()],
    [SETTINGS.webhookToken, String(formData.get('webhookToken') ?? '').trim()],
    [SETTINGS.zohoViewingFilter, String(formData.get('zohoViewingFilter') ?? '').trim()],
  ];
  for (const [key, value] of entries) await setSetting(key, value);
  revalidatePath('/admin/settings');
}

export async function triggerStateCheck() {
  if (!(await requireAdmin())) return;
  await runStateCheck();
  revalidatePath('/admin/settings');
  revalidatePath('/admin');
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

function temporaryPassword(): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  return Array.from({ length: 10 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}

export async function createPerson(formData: FormData) {
  if (!(await requireAdmin())) return;
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const name = String(formData.get('name') ?? '').trim();
  const branch = String(formData.get('branch') ?? '').trim();
  const role = String(formData.get('role') ?? 'AGENT') === 'ADMIN' ? 'ADMIN' : 'AGENT';
  const zohoUserId = String(formData.get('zohoUserId') ?? '').trim() || null;
  if (!email || !name) return;
  if (await prisma.user.findUnique({ where: { email } })) return;

  const password = temporaryPassword();
  await prisma.user.create({
    data: {
      email,
      name,
      branch: branch || null,
      role,
      zohoUserId,
      passwordHash: await bcrypt.hash(password, 10),
    },
  });
  revalidatePath('/admin/people');
  // The password is shown once in the redirect target, never stored in clear.
  return { email, password };
}

export async function resetPersonPassword(formData: FormData) {
  if (!(await requireAdmin())) return;
  const id = String(formData.get('id') ?? '');
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return;
  const password = temporaryPassword();
  await prisma.user.update({
    where: { id },
    data: { passwordHash: await bcrypt.hash(password, 10) },
  });
  revalidatePath('/admin/people');
  return { email: user.email, password };
}

// ---------------------------------------------------------------------------
// Viewings
// ---------------------------------------------------------------------------

export async function createViewing(formData: FormData) {
  if (!(await requireAdmin())) return;
  const agentId = String(formData.get('agentId') ?? '');
  const address = String(formData.get('address') ?? '').trim();
  const prospectName = String(formData.get('prospectName') ?? '').trim();
  const propertyRef = String(formData.get('propertyRef') ?? '').trim();
  const when = String(formData.get('when') ?? '');
  if (!agentId || !address || !prospectName) return;

  const visitDatetime = when ? new Date(when) : new Date(Date.now() - 3600_000);
  if (Number.isNaN(visitDatetime.getTime())) return;

  const zohoEventId = `manual-${Date.now().toString(36)}`;
  await prisma.visit.create({
    data: {
      zohoEventId,
      zohoDealId: `zd-${zohoEventId}`,
      zohoContactId: `zc-${zohoEventId}`,
      propertyRef: propertyRef || 'BE-0000-0000',
      address,
      prospectName,
      visitDatetime,
      agentId,
      status: 'PENDING',
    },
  });
  revalidatePath('/admin/viewings');
  revalidatePath('/admin');
  revalidatePath('/visits');
}

export async function setViewingCancelled(formData: FormData) {
  if (!(await requireAdmin())) return;
  const id = String(formData.get('id') ?? '');
  const cancel = String(formData.get('cancel') ?? 'true') === 'true';
  const visit = await prisma.visit.findUnique({ where: { id } });
  if (!visit) return;

  await prisma.visit.update({
    where: { id },
    data: { status: cancel ? 'CANCELLED' : 'PENDING' },
  });
  revalidatePath('/admin/viewings');
  revalidatePath('/admin');
  revalidatePath('/visits');
}
