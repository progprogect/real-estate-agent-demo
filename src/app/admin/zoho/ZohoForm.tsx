'use client';

import { useActionState, useState, useTransition } from 'react';
import {
  checkZohoConnection,
  loadZohoFields,
  runZohoSync,
  saveZohoSettings,
  type ZohoActionState,
} from '@/app/actions/zoho';
import { DATA_CENTER_OPTIONS, type ZohoField } from '@/lib/zoho';
import { t } from '@/lib/strings';
import { Field, PrimaryButton, SecondaryButton, inputClass } from '@/components/ui';

type Values = {
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
  windowDays: string;
};

export function ZohoForm({
  values,
  knownFields,
  lastSync,
}: {
  values: Values;
  knownFields: ZohoField[];
  lastSync: string;
}) {
  const [saveState, saveAction, saving] = useActionState<ZohoActionState, FormData>(
    saveZohoSettings,
    {}
  );
  const [result, setResult] = useState<ZohoActionState>({});
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<ZohoActionState>) =>
    startTransition(async () => setResult(await action()));

  const fieldList = (
    <datalist id="zoho-fields">
      {knownFields.map((f) => (
        <option key={f.apiName} value={f.apiName}>
          {f.label}
        </option>
      ))}
    </datalist>
  );

  const connection = result.connection;
  const sync = result.sync;

  return (
    <div className="space-y-5">
      {fieldList}

      <form action={saveAction} className="rounded-card border border-line bg-surface p-4">
        <p className="overline-label mb-1">{t.zoho.connection}</p>
        <p className="mb-3 text-xs leading-relaxed text-stone">{t.zoho.connectionHelp}</p>

        <Field label={t.zoho.dataCenter}>
          <select name="dataCenter" defaultValue={values.dataCenter} className={inputClass}>
            {DATA_CENTER_OPTIONS.map((d) => (
              <option key={d.code} value={d.code}>
                {d.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t.zoho.clientId}>
          <input name="clientId" defaultValue={values.clientId} className={inputClass} />
        </Field>
        <Field label={t.zoho.clientSecret} help={values.clientSecret ? t.zoho.secretKept : undefined}>
          <input name="clientSecret" defaultValue={values.clientSecret} className={inputClass} />
        </Field>
        <Field label={t.zoho.refreshToken} help={values.refreshToken ? t.zoho.secretKept : undefined}>
          <input name="refreshToken" defaultValue={values.refreshToken} className={inputClass} />
        </Field>

        <p className="overline-label mb-1 mt-5">{t.zoho.mapping}</p>
        <p className="mb-3 text-xs leading-relaxed text-stone">{t.zoho.mappingHelp}</p>
        <Field label={t.zoho.module}>
          <input name="module" defaultValue={values.module} className={inputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label={t.zoho.filterField}>
            <input
              name="filterField"
              list="zoho-fields"
              defaultValue={values.filterField}
              className={inputClass}
            />
          </Field>
          <Field label={t.zoho.filterValue}>
            <input name="filterValue" defaultValue={values.filterValue} className={inputClass} />
          </Field>
        </div>

        <p className="overline-label mb-2 mt-4">{t.zoho.fields}</p>
        <Field label={t.zoho.fieldAddress}>
          <input
            name="fieldAddress"
            list="zoho-fields"
            defaultValue={values.fieldAddress}
            className={inputClass}
          />
        </Field>
        <Field label={t.zoho.fieldProspect}>
          <input
            name="fieldProspect"
            list="zoho-fields"
            defaultValue={values.fieldProspect}
            className={inputClass}
          />
        </Field>
        <Field label={t.zoho.fieldPropertyRef}>
          <input
            name="fieldPropertyRef"
            list="zoho-fields"
            defaultValue={values.fieldPropertyRef}
            className={inputClass}
          />
        </Field>
        <Field label={t.zoho.fieldStart}>
          <input
            name="fieldStart"
            list="zoho-fields"
            defaultValue={values.fieldStart}
            className={inputClass}
          />
        </Field>
        <Field label={t.zoho.windowDays}>
          <input
            name="windowDays"
            type="number"
            min={1}
            defaultValue={values.windowDays}
            className={inputClass}
          />
        </Field>

        <PrimaryButton type="submit" disabled={saving}>
          {t.zoho.save}
        </PrimaryButton>
        {saveState.saved && (
          <p className="mt-2 text-center text-sm font-medium text-moss">{t.zoho.saved}</p>
        )}
      </form>

      <div className="grid grid-cols-2 gap-2">
        <SecondaryButton
          type="button"
          disabled={pending}
          onClick={() => run(checkZohoConnection)}
          className="w-full"
        >
          {pending ? t.zoho.testing : t.zoho.test}
        </SecondaryButton>
        <SecondaryButton
          type="button"
          disabled={pending}
          onClick={() => run(loadZohoFields)}
          className="w-full"
        >
          {t.zoho.loadFields}
        </SecondaryButton>
      </div>

      <SecondaryButton
        type="button"
        disabled={pending}
        onClick={() => run(runZohoSync)}
        className="w-full"
      >
        {pending ? t.zoho.syncing : t.zoho.sync}
      </SecondaryButton>

      {(connection || sync || result.fieldsLoaded !== undefined || result.error) && (
        <section
          className={`rounded-card border p-4 text-sm ${
            connection?.ok || sync?.ok || result.fieldsLoaded !== undefined
              ? 'border-moss/40 bg-moss-soft'
              : 'border-brick/40 bg-brick-soft'
          }`}
        >
          {connection?.ok && (
            <p className="font-medium text-moss">
              {t.zoho.connected(connection.org ?? '', connection.users ?? 0)}
            </p>
          )}
          {connection && !connection.ok && <p className="text-brick">{connection.error}</p>}
          {result.fieldsLoaded !== undefined && (
            <p className="font-medium text-moss">{t.zoho.fieldsLoaded(result.fieldsLoaded)}</p>
          )}
          {sync?.ok && <p className="text-ink">{t.zoho.syncResult(sync)}</p>}
          {sync?.ok && sync.unassigned > 0 && (
            <p className="mt-1 text-xs text-stone">{t.zoho.unassignedHelp}</p>
          )}
          {sync && !sync.ok && <p className="text-brick">{sync.error}</p>}
          {result.error && <p className="text-brick">{result.error}</p>}
        </section>
      )}

      <p className="text-xs text-stone">
        {lastSync ? t.zoho.lastSync(new Date(lastSync).toLocaleString('en-GB')) : t.zoho.neverSynced}
      </p>
    </div>
  );
}
