'use server';

import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';

export async function login(
  _prevState: { error: boolean },
  formData: FormData
): Promise<{ error: boolean }> {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const password = String(formData.get('password') ?? '');

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: true };
  }

  const session = await getSession();
  session.userId = user.id;
  session.role = user.role;
  session.name = user.name;
  session.email = user.email;
  await session.save();

  redirect(user.role === 'ADMIN' ? '/admin' : '/visits');
}

export async function logout() {
  const session = await getSession();
  session.destroy();
  redirect('/login');
}
