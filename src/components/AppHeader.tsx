import Link from 'next/link';
import { logout } from '@/app/actions/auth';
import { t } from '@/lib/strings';

export function AppHeader({
  userName,
  isAdmin,
  currentView,
}: {
  userName: string;
  isAdmin?: boolean;
  currentView?: 'agent' | 'admin';
}) {
  return (
    <header className="flex items-center justify-between px-5 pb-2 pt-5">
      <div>
        <span className="font-display text-lg font-semibold">{t.appName}</span>
        <span className="ml-2 text-sm text-stone">{userName}</span>
      </div>
      <div className="flex items-center gap-3 text-sm">
        {isAdmin && currentView === 'agent' && (
          <Link href="/admin" className="font-medium text-pine underline underline-offset-2">
            {t.nav.admin}
          </Link>
        )}
        {isAdmin && currentView === 'admin' && (
          <Link href="/visits" className="font-medium text-pine underline underline-offset-2">
            {t.nav.myVisits}
          </Link>
        )}
        <form action={logout}>
          <button type="submit" className="text-stone underline underline-offset-2">
            {t.nav.signOut}
          </button>
        </form>
      </div>
    </header>
  );
}
