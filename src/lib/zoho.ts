/**
 * Zoho CRM connection (brief, package 3): read-only.
 *
 * Credentials and the field mapping are entered by an administrator and stored
 * as settings, so connecting a new environment never needs a release. Nothing
 * here ever writes to Zoho — the brief forbids it.
 */

import { prisma } from '@/lib/db';
import { SETTINGS, getSettings, setSetting } from '@/lib/settings';

export type ZohoConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  dataCenter: string;
  module: string;
  filterField: string;
  filterValue: string;
  fieldAddress: string;
  fieldProspect: string;
  fieldPropertyRef: string;
  fieldStart: string;
  windowDays: number;
};

const DATA_CENTERS: Record<string, { accounts: string; api: string }> = {
  eu: { accounts: 'https://accounts.zoho.eu', api: 'https://www.zohoapis.eu' },
  com: { accounts: 'https://accounts.zoho.com', api: 'https://www.zohoapis.com' },
  in: { accounts: 'https://accounts.zoho.in', api: 'https://www.zohoapis.in' },
  au: { accounts: 'https://accounts.zoho.com.au', api: 'https://www.zohoapis.com.au' },
  jp: { accounts: 'https://accounts.zoho.jp', api: 'https://www.zohoapis.jp' },
  ca: { accounts: 'https://accounts.zohocloud.ca', api: 'https://www.zohoapis.ca' },
};

export const DATA_CENTER_OPTIONS = [
  { code: 'eu', label: 'Europe (zoho.eu)' },
  { code: 'com', label: 'United States (zoho.com)' },
  { code: 'in', label: 'India (zoho.in)' },
  { code: 'au', label: 'Australia (zoho.com.au)' },
  { code: 'jp', label: 'Japan (zoho.jp)' },
  { code: 'ca', label: 'Canada (zohocloud.ca)' },
];

export async function loadZohoConfig(): Promise<ZohoConfig> {
  const s = await getSettings();
  return {
    clientId: s[SETTINGS.zohoClientId] ?? '',
    clientSecret: s[SETTINGS.zohoClientSecret] ?? '',
    refreshToken: s[SETTINGS.zohoRefreshToken] ?? '',
    dataCenter: s[SETTINGS.zohoDataCenter] || 'eu',
    module: s[SETTINGS.zohoModule] || 'Events',
    filterField: s[SETTINGS.zohoFilterField] || 'Event_Title',
    filterValue: s[SETTINGS.zohoViewingFilter] || '',
    fieldAddress: s[SETTINGS.zohoFieldAddress] || 'Venue',
    fieldProspect: s[SETTINGS.zohoFieldProspect] || 'Who_Id',
    fieldPropertyRef: s[SETTINGS.zohoFieldPropertyRef] || 'What_Id',
    fieldStart: s[SETTINGS.zohoFieldStart] || 'Start_DateTime',
    windowDays: Number(s[SETTINGS.zohoSyncWindowDays]) || 14,
  };
}

export function isConfigured(config: ZohoConfig): boolean {
  return Boolean(config.clientId && config.clientSecret && config.refreshToken);
}

function hosts(dataCenter: string) {
  return DATA_CENTERS[dataCenter] ?? DATA_CENTERS.eu;
}

/** Access tokens live an hour; keep one in memory rather than refreshing per call. */
let cachedToken: { token: string; expiresAt: number; fingerprint: string } | null = null;

async function getAccessToken(config: ZohoConfig): Promise<string> {
  const fingerprint = `${config.dataCenter}:${config.clientId}:${config.refreshToken.slice(-8)}`;
  if (cachedToken && cachedToken.fingerprint === fingerprint && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  const params = new URLSearchParams({
    refresh_token: config.refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'refresh_token',
  });
  const res = await fetch(`${hosts(config.dataCenter).accounts}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(`Zoho refused the refresh token${data.error ? `: ${data.error}` : ''}`);
  }

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 - 60_000,
    fingerprint,
  };
  return cachedToken.token;
}

async function zohoGet<T>(config: ZohoConfig, path: string): Promise<T> {
  const token = await getAccessToken(config);
  const res = await fetch(`${hosts(config.dataCenter).api}${path}`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });
  if (res.status === 204) return {} as T;
  if (!res.ok) {
    throw new Error(`Zoho ${path} returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Connection check and field discovery
// ---------------------------------------------------------------------------

export type ConnectionResult = {
  ok: boolean;
  org?: string;
  users?: number;
  error?: string;
};

export async function testConnection(config: ZohoConfig): Promise<ConnectionResult> {
  if (!isConfigured(config)) {
    return { ok: false, error: 'Client id, client secret and refresh token are all required.' };
  }
  try {
    const org = await zohoGet<{ org?: { company_name?: string }[] }>(config, '/crm/v7/org');
    const users = await zohoGet<{ users?: unknown[] }>(config, '/crm/v7/users?type=ActiveUsers');
    return {
      ok: true,
      org: org.org?.[0]?.company_name ?? 'Connected',
      users: users.users?.length ?? 0,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Connection failed' };
  }
}

export type ZohoField = { apiName: string; label: string };

export async function discoverFields(config: ZohoConfig): Promise<ZohoField[]> {
  const data = await zohoGet<{ fields?: { api_name: string; field_label: string }[] }>(
    config,
    `/crm/v7/settings/fields?module=${encodeURIComponent(config.module)}`
  );
  return (data.fields ?? []).map((f) => ({ apiName: f.api_name, label: f.field_label }));
}

export async function refreshKnownFields(config: ZohoConfig): Promise<ZohoField[]> {
  const fields = await discoverFields(config);
  await setSetting(SETTINGS.zohoKnownFields, JSON.stringify(fields));
  return fields;
}

export async function getKnownFields(): Promise<ZohoField[]> {
  const raw = (await getSettings())[SETTINGS.zohoKnownFields];
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ZohoField[];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

export type SyncResult = {
  ok: boolean;
  fetched: number;
  matched: number;
  created: number;
  updated: number;
  cancelled: number;
  unassigned: number;
  error?: string;
};

type ZohoRecord = Record<string, unknown>;

/** Zoho returns lookups as {id, name}; read either shape without guessing. */
function readValue(record: ZohoRecord, field: string): string {
  const raw = record[field];
  if (raw == null) return '';
  if (typeof raw === 'object') {
    const obj = raw as { name?: string; id?: string };
    return obj.name ?? obj.id ?? '';
  }
  return String(raw);
}

function matchesFilter(record: ZohoRecord, config: ZohoConfig): boolean {
  if (!config.filterValue) return true;
  const value = readValue(record, config.filterField).toLowerCase();
  return value.includes(config.filterValue.toLowerCase());
}

export async function syncViewings(): Promise<SyncResult> {
  const empty: SyncResult = {
    ok: false,
    fetched: 0,
    matched: 0,
    created: 0,
    updated: 0,
    cancelled: 0,
    unassigned: 0,
  };
  const config = await loadZohoConfig();
  if (!isConfigured(config)) {
    return { ...empty, error: 'Zoho is not connected yet.' };
  }

  try {
    const since = new Date(Date.now() - config.windowDays * 24 * 3600_000).toISOString();
    const data = await zohoGet<{ data?: ZohoRecord[] }>(
      config,
      `/crm/v7/${encodeURIComponent(config.module)}?per_page=200&sort_by=Modified_Time&sort_order=desc`
    );
    const records = (data.data ?? []).filter((r) => {
      const start = readValue(r, config.fieldStart);
      return !start || new Date(start) >= new Date(since);
    });

    const agents = await prisma.user.findMany({
      select: { id: true, email: true, zohoUserId: true },
    });
    const byZohoId = new Map(agents.filter((a) => a.zohoUserId).map((a) => [a.zohoUserId!, a.id]));
    const byEmail = new Map(agents.map((a) => [a.email.toLowerCase(), a.id]));

    const result: SyncResult = { ...empty, ok: true, fetched: records.length };
    const seenIds: string[] = [];

    for (const record of records) {
      if (!matchesFilter(record, config)) continue;
      result.matched++;

      const zohoEventId = String(record.id ?? '');
      if (!zohoEventId) continue;
      seenIds.push(zohoEventId);

      const owner = (record.Owner ?? {}) as { id?: string; email?: string };
      const agentId =
        (owner.id && byZohoId.get(owner.id)) ||
        (owner.email && byEmail.get(owner.email.toLowerCase())) ||
        null;
      if (!agentId) {
        result.unassigned++;
        continue;
      }

      const startRaw = readValue(record, config.fieldStart);
      const visitDatetime = startRaw ? new Date(startRaw) : new Date();
      if (Number.isNaN(visitDatetime.getTime())) continue;

      const fields = {
        propertyRef: readValue(record, config.fieldPropertyRef) || 'unknown',
        address: readValue(record, config.fieldAddress) || 'Unknown address',
        prospectName: readValue(record, config.fieldProspect) || 'Unknown prospect',
        visitDatetime,
        agentId,
        zohoDealId: (record.What_Id as { id?: string })?.id ?? null,
        zohoContactId: (record.Who_Id as { id?: string })?.id ?? null,
      };

      const existing = await prisma.visit.findUnique({ where: { zohoEventId } });
      if (!existing) {
        await prisma.visit.create({ data: { zohoEventId, ...fields, status: 'PENDING' } });
        result.created++;
        continue;
      }

      // A viewing that is answered or expired never comes back into the to-do
      // list, even if Zoho still returns it (brief 5.3). Reschedules do land.
      const closed = existing.status === 'ANSWERED' || existing.status === 'EXPIRED';
      await prisma.visit.update({
        where: { zohoEventId },
        data: closed
          ? { address: fields.address, prospectName: fields.prospectName }
          : { ...fields, status: existing.status === 'CANCELLED' ? 'PENDING' : existing.status },
      });
      result.updated++;
    }

    // Anything we imported before and Zoho no longer returns was cancelled there.
    if (seenIds.length) {
      const cancelled = await prisma.visit.updateMany({
        where: {
          zohoEventId: { notIn: seenIds, not: { startsWith: 'manual-' } },
          status: { in: ['PENDING', 'REMINDER_SENT', 'DRAFT'] },
        },
        data: { status: 'CANCELLED' },
      });
      result.cancelled = cancelled.count;
    }

    await setSetting(SETTINGS.zohoLastSync, new Date().toISOString());
    return result;
  } catch (err) {
    return { ...empty, error: err instanceof Error ? err.message : 'Sync failed' };
  }
}
