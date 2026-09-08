'use server';

import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { t } from '@/lib/strings';

export type PasswordState = { error?: string; done?: boolean };

export async function changePassword(
  _prev: PasswordState,
  formData: FormData
): Promise<PasswordState> {
  const session = await getSession();
  if (!session.userId) return { error: t.login.invalid };

  const current = String(formData.get('current') ?? '');
  const next = String(formData.get('next') ?? '');
  const repeat = String(formData.get('repeat') ?? '');

  if (next.length < 8) return { error: t.account.tooShort };
  if (next !== repeat) return { error: t.account.mismatch };

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || !(await bcrypt.compare(current, user.passwordHash))) {
    return { error: t.account.wrongCurrent };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(next, 10) },
  });
  return { done: true };
}
