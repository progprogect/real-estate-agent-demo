import { getIronSession, type SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';

export type SessionData = {
  userId?: string;
  role?: 'AGENT' | 'ADMIN';
  name?: string;
  email?: string;
};

const THIRTY_DAYS = 60 * 60 * 24 * 30;

export const sessionOptions: SessionOptions = {
  cookieName: 'vfa_session',
  password: process.env.SESSION_SECRET ?? 'insecure-dev-secret-do-not-use-in-prod',
  ttl: THIRTY_DAYS,
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: THIRTY_DAYS,
  },
};

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

export async function requireUser() {
  const session = await getSession();
  if (!session.userId) return null;
  return session;
}
