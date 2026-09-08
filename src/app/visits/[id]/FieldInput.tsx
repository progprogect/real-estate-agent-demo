'use client';

import { t } from '@/lib/strings';
import type { CriterionView } from '@/lib/types';
import { inputClass, textareaClass } from '@/components/ui';

/** Renders the editor for whichever answer type the criterion is configured as. */
export function FieldEditor({
  criterion,
  value,
  onChange,
}: {
  criterion: CriterionView;
  value: string;
  onChange: (value: string) => void;
}) {
  if (criterion.type === 'rating') {
    const scale = Array.from({ length: criterion.ratingMax }, (_, i) => i + 1);
    return (
      <div className="flex flex-wrap gap-1.5">
        {scale.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(String(n))}
            className={`h-11 min-w-11 flex-1 rounded-card border text-[15px] font-medium tnum ${
              value === String(n)
                ? 'border-pine bg-pine text-paper'
                : 'border-line bg-surface text-ink'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    );
  }

  if (criterion.type === 'choice') {
    return (
      <div className="flex flex-wrap gap-1.5">
        {criterion.options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`h-11 rounded-card border px-3 text-[15px] font-medium ${
              value === option ? 'border-pine bg-pine text-paper' : 'border-line bg-surface text-ink'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    );
  }

  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={3}
      className={textareaClass}
      placeholder={t.feedback.typeHere}
      autoFocus
    />
  );
}

/** Read-only rendering of a value that already has content. */
export function FieldValue({
  criterion,
  value,
}: {
  criterion: CriterionView;
  value: string;
}) {
  if (criterion.type === 'rating') {
    return (
      <p className="font-display text-2xl font-semibold tnum">
        {value}
        <span className="ml-1 text-sm font-normal text-stone">/ {criterion.ratingMax}</span>
      </p>
    );
  }
  if (criterion.type === 'choice') {
    return (
      <span className="inline-block rounded-chip bg-pine-soft px-3 py-1.5 text-[15px] font-medium text-pine">
        {value}
      </span>
    );
  }
  return <p className="text-[15px] leading-relaxed">{value}</p>;
}

export { inputClass };
