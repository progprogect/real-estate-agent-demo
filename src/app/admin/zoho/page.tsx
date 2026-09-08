import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { SETTINGS, getSettings, maskSecret } from '@/lib/settings';
import { getKnownFields } from '@/lib/zoho';
import { t } from '@/lib/strings';
import { AdminPageHeader } from '@/components/ui';
import { ZohoForm } from './ZohoForm';

export const dynamic = 'force-dynamic';

export default async function ZohoPage() {
  const session = await getSession();
  if (!session.userId) redirect('/login');
  if (session.role !== 'ADMIN') redirect('/visits');

  const [values, knownFields] = await Promise.all([getSettings(), getKnownFields()]);

  return (
    <main className="pb-12">
      <AdminPageHeader title={t.zoho.title} subtitle={t.zoho.subtitle} />
      <div className="px-5">
        <ZohoForm
          values={{
            clientId: values[SETTINGS.zohoClientId],
            clientSecret: maskSecret(values[SETTINGS.zohoClientSecret]),
            refreshToken: maskSecret(values[SETTINGS.zohoRefreshToken]),
            dataCenter: values[SETTINGS.zohoDataCenter],
            module: values[SETTINGS.zohoModule],
            filterField: values[SETTINGS.zohoFilterField],
            filterValue: values[SETTINGS.zohoViewingFilter],
            fieldAddress: values[SETTINGS.zohoFieldAddress],
            fieldProspect: values[SETTINGS.zohoFieldProspect],
            fieldPropertyRef: values[SETTINGS.zohoFieldPropertyRef],
            fieldStart: values[SETTINGS.zohoFieldStart],
            windowDays: values[SETTINGS.zohoSyncWindowDays],
          }}
          knownFields={knownFields}
          lastSync={values[SETTINGS.zohoLastSync]}
        />
      </div>
    </main>
  );
}
