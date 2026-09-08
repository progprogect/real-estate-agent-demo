'use client';

import { useState } from 'react';
import { createCriterion, moveCriterion, toggleCriterion, updateCriterion } from '@/app/actions/config';
import { t } from '@/lib/strings';
import { Field, PrimaryButton, SecondaryButton, inputClass, textareaClass } from '@/components/ui';

type Criterion = {
  id: string;
  key: string;
  label: string;
  hint: string;
  type: string;
  options: string[];
  ratingMax: number;
  active: boolean;
};

function TypeFields({
  type,
  ratingMax,
  options,
  onTypeChange,
}: {
  type: string;
  ratingMax: number;
  options: string[];
  onTypeChange: (value: string) => void;
}) {
  return (
    <>
      <Field label={t.criteria.type}>
        <select
          name="type"
          value={type}
          onChange={(e) => onTypeChange(e.target.value)}
          className={inputClass}
        >
          <option value="text">{t.criteria.typeText}</option>
          <option value="rating">{t.criteria.typeRating}</option>
          <option value="choice">{t.criteria.typeChoice}</option>
        </select>
      </Field>

      {type === 'rating' && (
        <Field label={t.criteria.ratingMax}>
          <input
            name="ratingMax"
            type="number"
            min={2}
            max={10}
            defaultValue={ratingMax}
            className={inputClass}
          />
        </Field>
      )}

      {type === 'choice' && (
        <Field label={t.criteria.options} help={t.criteria.needsOptions}>
          <textarea
            name="options"
            rows={4}
            defaultValue={options.join('\n')}
            className={textareaClass}
          />
        </Field>
      )}
    </>
  );
}

export function CriterionEditor({
  criterion,
  isFirst,
  isLast,
}: {
  criterion: Criterion;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState(criterion.type);

  return (
    <section
      className={`rounded-card border p-4 ${criterion.active ? 'border-line bg-surface' : 'border-line bg-paper'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold leading-tight">{criterion.label}</h2>
          <p className="mt-0.5 text-sm text-stone">{criterion.hint || '—'}</p>
          <p className="mt-1.5 text-xs text-stone">
            <code>{criterion.key}</code> ·{' '}
            {criterion.type === 'rating'
              ? `${t.criteria.typeRating} (1–${criterion.ratingMax})`
              : criterion.type === 'choice'
                ? `${t.criteria.typeChoice}: ${criterion.options.join(', ')}`
                : t.criteria.typeText}
            {!criterion.active && ` · ${t.criteria.inactive}`}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          <form action={moveCriterion}>
            <input type="hidden" name="id" value={criterion.id} />
            <input type="hidden" name="direction" value="up" />
            <button
              type="submit"
              disabled={isFirst}
              aria-label={t.criteria.moveUp}
              className="h-8 w-8 rounded-chip border border-line text-stone disabled:opacity-30"
            >
              ↑
            </button>
          </form>
          <form action={moveCriterion}>
            <input type="hidden" name="id" value={criterion.id} />
            <input type="hidden" name="direction" value="down" />
            <button
              type="submit"
              disabled={isLast}
              aria-label={t.criteria.moveDown}
              className="h-8 w-8 rounded-chip border border-line text-stone disabled:opacity-30"
            >
              ↓
            </button>
          </form>
        </div>
      </div>

      {!open ? (
        <div className="mt-3 flex gap-2">
          <SecondaryButton type="button" onClick={() => setOpen(true)} className="flex-1">
            {t.feedback.edit}
          </SecondaryButton>
          <form action={toggleCriterion} className="flex-1">
            <input type="hidden" name="id" value={criterion.id} />
            <SecondaryButton type="submit" className="w-full">
              {criterion.active ? t.criteria.deactivate : t.criteria.activate}
            </SecondaryButton>
          </form>
        </div>
      ) : (
        <form action={updateCriterion} className="mt-4 border-t border-line pt-4">
          <input type="hidden" name="id" value={criterion.id} />
          <Field label={t.criteria.label}>
            <input name="label" defaultValue={criterion.label} required className={inputClass} />
          </Field>
          <Field label={t.criteria.hint} help={t.criteria.hintHelp}>
            <input name="hint" defaultValue={criterion.hint} className={inputClass} />
          </Field>
          <TypeFields
            type={type}
            ratingMax={criterion.ratingMax}
            options={criterion.options}
            onTypeChange={setType}
          />
          <Field label={t.criteria.key} help={t.criteria.keyLocked}>
            <input value={criterion.key} readOnly disabled className={`${inputClass} text-stone`} />
          </Field>
          <div className="flex gap-2">
            <SecondaryButton type="button" onClick={() => setOpen(false)} className="flex-1">
              {t.feedback.cancelEdit}
            </SecondaryButton>
            <PrimaryButton type="submit" className="flex-1">
              {t.criteria.save}
            </PrimaryButton>
          </div>
        </form>
      )}
    </section>
  );
}

export function NewCriterionForm() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('text');

  if (!open) {
    return (
      <SecondaryButton type="button" onClick={() => setOpen(true)} className="w-full">
        + {t.criteria.add}
      </SecondaryButton>
    );
  }

  return (
    <form action={createCriterion} className="rounded-card border border-line bg-surface p-4">
      <h2 className="mb-3 font-display text-lg font-semibold">{t.criteria.addTitle}</h2>
      <Field label={t.criteria.label}>
        <input name="label" required className={inputClass} />
      </Field>
      <Field label={t.criteria.hint} help={t.criteria.hintHelp}>
        <input name="hint" className={inputClass} />
      </Field>
      <TypeFields type={type} ratingMax={5} options={[]} onTypeChange={setType} />
      <div className="flex gap-2">
        <SecondaryButton type="button" onClick={() => setOpen(false)} className="flex-1">
          {t.feedback.cancelEdit}
        </SecondaryButton>
        <PrimaryButton type="submit" className="flex-1">
          {t.criteria.add}
        </PrimaryButton>
      </div>
    </form>
  );
}
