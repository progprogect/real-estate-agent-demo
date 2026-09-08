import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { t } from '@/lib/strings';
import { PasswordForm } from './PasswordForm';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const session = await getSession();
  if (!session.userId) redirect('/login');

  return (
    <main className="pb-12">
      <header className="px-5 pb-4 pt-5">
        <Link
          href={session.role === 'ADMIN' ? '/admin' : '/visits'}
          className="text-sm text-pine underline underline-offset-2"
        >
          ← {session.role === 'ADMIN' ? t.nav.admin : t.nav.myVisits}
        </Link>
        <h1 className="mt-3 font-display text-2xl font-semibold">{t.account.title}</h1>
        <p className="mt-1 text-sm text-stone">
          {session.email} · {t.account.subtitle}
        </p>
      </header>
      <div className="px-5">
        <PasswordForm />
      </div>
    </main>
  );
}
