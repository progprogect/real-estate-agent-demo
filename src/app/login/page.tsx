import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { LoginForm } from './LoginForm';
import { t } from '@/lib/strings';

export default async function LoginPage() {
  const session = await getSession();
  if (session.userId) redirect(session.role === 'ADMIN' ? '/admin' : '/visits');

  return (
    <main className="flex min-h-dvh flex-col justify-center px-5 pb-16">
      <header className="mb-10">
        <p className="overline-label mb-3">{t.appTagline}</p>
        <h1 className="font-display text-4xl font-semibold">{t.appName}</h1>
      </header>
      <LoginForm />
      <p className="mt-8 text-xs leading-relaxed text-stone">{t.login.hint}</p>
    </main>
  );
}
