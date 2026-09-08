'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/session';
import { SETTINGS, setSetting } from '@/lib/settings';
import {
  loadZohoConfig,
  refreshKnownFields,
  syncViewings,
  testConnection,
  type ConnectionResult,
  type SyncResult,
} from '@/lib/zoho';

export type ZohoActionState = {
  connection?: ConnectionResult;
  sync?: SyncResult;
  fieldsLoaded?: number;
  error?: string;
  saved?: boolean;
};

async function isAdmin() {
  const session = await getSession();
  return Boolean(session.userId && session.role === 'ADMIN');
}

export async function saveZohoSettings(
  _prev: ZohoActionState,
  formData: FormData
): Promise<ZohoActionState> {
  if (!(await isAdmin())) return { error: 'Unauthorized' };

  // Secrets are rendered masked, so an untouched field must not overwrite the
  // stored value with the mask.
  const secret = (name: string) => {
    const value = String(formData.get(name) ?? '').trim();
    return value.startsWith('••') ? null : value;
  };

  const plain: [string, string][] = [
    [SETTINGS.zohoClientId, String(formData.get('clientId') ?? '').trim()],
    [SETTINGS.zohoDataCenter, String(formData.get('dataCenter') ?? 'eu')],
    [SETTINGS.zohoModule, String(formData.get('module') ?? 'Events').trim()],
    [SETTINGS.zohoFilterField, String(formData.get('filterField') ?? '').trim()],
    [SETTINGS.zohoViewingFilter, String(formData.get('filterValue') ?? '').trim()],
    [SETTINGS.zohoFieldAddress, String(formData.get('fieldAddress') ?? '').trim()],
    [SETTINGS.zohoFieldProspect, String(formData.get('fieldProspect') ?? '').trim()],
    [SETTINGS.zohoFieldPropertyRef, String(formData.get('fieldPropertyRef') ?? '').trim()],
    [SETTINGS.zohoFieldStart, String(formData.get('fieldStart') ?? '').trim()],
    [SETTINGS.zohoSyncWindowDays, String(formData.get('windowDays') ?? '14')],
  ];
  for (const [key, value] of plain) await setSetting(key, value);

  const clientSecret = secret('clientSecret');
  if (clientSecret !== null) await setSetting(SETTINGS.zohoClientSecret, clientSecret);
  const refreshToken = secret('refreshToken');
  if (refreshToken !== null) await setSetting(SETTINGS.zohoRefreshToken, refreshToken);

  revalidatePath('/admin/zoho');
  return { saved: true };
}

export async function checkZohoConnection(): Promise<ZohoActionState> {
  if (!(await isAdmin())) return { error: 'Unauthorized' };
  return { connection: await testConnection(await loadZohoConfig()) };
}

export async function loadZohoFields(): Promise<ZohoActionState> {
  if (!(await isAdmin())) return { error: 'Unauthorized' };
  try {
    const fields = await refreshKnownFields(await loadZohoConfig());
    revalidatePath('/admin/zoho');
    return { fieldsLoaded: fields.length };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not read the module fields' };
  }
}

export async function runZohoSync(): Promise<ZohoActionState> {
  if (!(await isAdmin())) return { error: 'Unauthorized' };
  const sync = await syncViewings();
  revalidatePath('/admin/zoho');
  revalidatePath('/admin');
  revalidatePath('/visits');
  return { sync };
}
