import { prisma } from '@/lib/db';
import type { OutputLanguage } from '@/lib/types';

export const SETTINGS = {
  outputLanguage: 'output_language',
  reminderFirstHours: 'reminder_first_hours',
  reminderSecondHours: 'reminder_second_hours',
  expiryDays: 'expiry_days',
  webhookUrl: 'webhook_url',
  webhookToken: 'webhook_token',
  /// Zoho connection, entered by an administrator rather than redeployed.
  zohoClientId: 'zoho_client_id',
  zohoClientSecret: 'zoho_client_secret',
  zohoRefreshToken: 'zoho_refresh_token',
  zohoDataCenter: 'zoho_data_center',
  zohoModule: 'zoho_module',
  /// The recognition rule: which events count as property viewings.
  zohoViewingFilter: 'zoho_viewing_filter',
  zohoFilterField: 'zoho_filter_field',
  /// Where each piece of a viewing lives in the Zoho record.
  zohoFieldAddress: 'zoho_field_address',
  zohoFieldProspect: 'zoho_field_prospect',
  zohoFieldPropertyRef: 'zoho_field_property_ref',
  zohoFieldStart: 'zoho_field_start',
  zohoSyncWindowDays: 'zoho_sync_window_days',
  /// Cached field list from the module, so mapping offers real choices.
  zohoKnownFields: 'zoho_known_fields',
  zohoLastSync: 'zoho_last_sync',
} as const;

export const SETTING_DEFAULTS: Record<string, string> = {
  [SETTINGS.outputLanguage]: 'auto',
  [SETTINGS.reminderFirstHours]: '4',
  [SETTINGS.reminderSecondHours]: '24',
  [SETTINGS.expiryDays]: '7',
  [SETTINGS.webhookUrl]: '',
  [SETTINGS.webhookToken]: '',
  [SETTINGS.zohoClientId]: '',
  [SETTINGS.zohoClientSecret]: '',
  [SETTINGS.zohoRefreshToken]: '',
  [SETTINGS.zohoDataCenter]: 'eu',
  [SETTINGS.zohoModule]: 'Events',
  [SETTINGS.zohoViewingFilter]: 'Property Viewing',
  [SETTINGS.zohoFilterField]: 'Event_Title',
  [SETTINGS.zohoFieldAddress]: 'Venue',
  [SETTINGS.zohoFieldProspect]: 'Who_Id',
  [SETTINGS.zohoFieldPropertyRef]: 'What_Id',
  [SETTINGS.zohoFieldStart]: 'Start_DateTime',
  [SETTINGS.zohoSyncWindowDays]: '14',
  [SETTINGS.zohoKnownFields]: '',
  [SETTINGS.zohoLastSync]: '',
};

/** Never render a stored secret in full; the admin only needs to recognise it. */
export function maskSecret(value: string): string {
  if (!value) return '';
  if (value.length <= 8) return '••••';
  return `••••${value.slice(-4)}`;
}

export async function getSettings(): Promise<Record<string, string>> {
  const rows = await prisma.appSetting.findMany();
  const values = { ...SETTING_DEFAULTS };
  for (const row of rows) values[row.key] = row.value;
  return values;
}

export async function getSetting(key: string): Promise<string> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row?.value ?? SETTING_DEFAULTS[key] ?? '';
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export async function getOutputLanguage(): Promise<OutputLanguage> {
  const value = await getSetting(SETTINGS.outputLanguage);
  return (['auto', 'fr', 'nl', 'en'].includes(value) ? value : 'auto') as OutputLanguage;
}

export function numberSetting(values: Record<string, string>, key: string): number {
  const parsed = Number(values[key]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : Number(SETTING_DEFAULTS[key]);
}
