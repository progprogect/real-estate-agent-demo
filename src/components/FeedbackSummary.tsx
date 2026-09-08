import { t } from '@/lib/strings';
import { formatVisitTime } from '@/lib/format';
import { StatusChip } from '@/components/StatusChip';
import type { CriterionType, DraftValues } from '@/lib/types';

export type SummaryCriterion = {
  key: string;
  label: string;
  type: CriterionType;
  ratingMax: number;
};

export type SummaryVisit = {
  status: string;
  address: string;
  prospectName: string;
  propertyRef: string;
  visitDatetime: Date;
  agentName?: string;
  values: DraftValues;
  generalFeedback: string;
  verbatim: string;
  takes: { index: number; mode: string; fieldKey: string | null; durationS: number }[];
  submission: {
    status: string;
    attempts: number;
    lastError: string | null;
    submittedAt: Date;
    deliveredAt: Date | null;
    payload: unknown;
  } | null;
};

function renderValue(criterion: SummaryCriterion, value: string) {
  if (!value) return <span className="text-stone">—</span>;
  if (criterion.type === 'rating') {
    return (
      <span className="font-display text-xl font-semibold tnum">
        {value}
        <span className="ml-1 text-sm font-normal text-stone">/ {criterion.ratingMax}</span>
      </span>
    );
  }
  if (criterion.type === 'choice') {
    return (
      <span className="inline-block rounded-chip bg-pine-soft px-2.5 py-1 text-sm font-medium text-pine">
        {value}
      </span>
    );
  }
  return <span className="text-[15px] leading-relaxed">{value}</span>;
}

export function FeedbackSummary({
  visit,
  criteria,
  showPayload = false,
}: {
  visit: SummaryVisit;
  criteria: SummaryCriterion[];
  showPayload?: boolean;
}) {
  const { time, date } = formatVisitTime(visit.visitDatetime);
  const totalSeconds = visit.takes.reduce((sum, tk) => sum + tk.durationS, 0);

  return (
    <div className="space-y-4">
      <section className="rounded-card border border-line bg-surface p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h2 className="font-display text-xl font-semibold leading-snug">{visit.address}</h2>
          <StatusChip status={visit.status} />
        </div>
        <p className="text-sm text-stone">
          {visit.prospectName} · {date}, <span className="tnum">{time}</span>
          {visit.agentName ? ` · ${visit.agentName}` : ''} · {visit.propertyRef}
        </p>
      </section>

      {criteria.map((c) => {
        const v = visit.values[c.key];
        return (
          <section key={c.key} className="rounded-card border border-line bg-surface p-4">
            <p className="overline-label mb-2">{c.label}</p>
            {renderValue(c, v?.value ?? '')}
            {v?.editedByAgent && (
              <p className="mt-2 text-xs text-stone">{t.summary.editedByAgent}</p>
            )}
          </section>
        );
      })}

      {visit.generalFeedback && (
        <section className="rounded-card border border-line bg-surface p-4">
          <p className="overline-label mb-2">{t.feedback.generalFeedback}</p>
          <p className="text-[15px] leading-relaxed">{visit.generalFeedback}</p>
        </section>
      )}

      {visit.verbatim && (
        <section className="rounded-card border border-line bg-paper p-4">
          <p className="overline-label mb-2">{t.feedback.verbatim}</p>
          <p className="whitespace-pre-line font-display text-[15px] italic leading-relaxed text-stone">
            “{visit.verbatim}”
          </p>
          {visit.takes.length > 0 && (
            <p className="mt-2 text-xs text-stone">
              {t.summary.takesSummary(visit.takes.length, totalSeconds)}
            </p>
          )}
        </section>
      )}

      {visit.submission && (
        <section className="rounded-card border border-line bg-surface p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="overline-label">{t.summary.delivery}</p>
            <StatusChip
              status={visit.submission.status === 'DELIVERED' ? 'ANSWERED' : 'FAILED'}
              label={
                visit.submission.status === 'DELIVERED' ? t.events.delivered : t.events.failed
              }
            />
          </div>
          <p className="text-xs text-stone">
            {t.summary.submittedAt(visit.submission.submittedAt.toLocaleString('en-GB'))}
            {visit.submission.attempts > 1
              ? ` · ${t.summary.attempts(visit.submission.attempts)}`
              : ''}
            {visit.submission.lastError ? ` · ${visit.submission.lastError}` : ''}
          </p>

          {showPayload && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium text-pine">
                {t.summary.showPayload}
              </summary>
              <pre className="mt-2 overflow-x-auto rounded-card border border-line bg-paper p-3 text-xs leading-relaxed">
                {JSON.stringify(visit.submission.payload, null, 2)}
              </pre>
            </details>
          )}
        </section>
      )}
    </div>
  );
}
