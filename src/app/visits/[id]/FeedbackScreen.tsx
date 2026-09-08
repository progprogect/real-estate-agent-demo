'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { startRecording, type RecorderHandle } from '@/lib/audio-client';
import { t } from '@/lib/strings';
import { formatVisitTime } from '@/lib/format';
import type { AnalyzeResponse, CriterionView, DraftValues } from '@/lib/types';

type Props = {
  visitId: string;
  address: string;
  prospectName: string;
  visitDatetimeIso: string;
  criteria: CriterionView[];
  initialValues: DraftValues;
  initialGeneralFeedback: string;
  initialVerbatim: string;
};

type RecState =
  | { phase: 'idle' }
  | { phase: 'recording'; target: 'general' | string; startedAt: number }
  | { phase: 'recorded'; wav: Blob; durationS: number; url: string }
  | { phase: 'processing'; target: 'general' | string };

export function FeedbackScreen({
  visitId,
  address,
  prospectName,
  visitDatetimeIso,
  criteria,
  initialValues,
  initialGeneralFeedback,
  initialVerbatim,
}: Props) {
  const [values, setValues] = useState<DraftValues>(() => {
    const base: DraftValues = {};
    for (const c of criteria) {
      base[c.key] =
        initialValues[c.key] ?? { value: '', state: 'missing', confirmed: false, editedByAgent: false };
    }
    return base;
  });
  const [generalFeedback, setGeneralFeedback] = useState(initialGeneralFeedback);
  const [verbatim, setVerbatim] = useState(initialVerbatim);
  const [audioDurationS, setAudioDurationS] = useState(0);
  const [rec, setRec] = useState<RecState>({ phase: 'idle' });
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [micError, setMicError] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisDone, setAnalysisDone] = useState(false);
  const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'failed' | 'done'>('idle');
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const recorderRef = useRef<RecorderHandle | null>(null);
  const dirtyRef = useRef(false);

  const { time, date } = useMemo(
    () => formatVisitTime(new Date(visitDatetimeIso)),
    [visitDatetimeIso]
  );

  // ---- draft autosave -------------------------------------------------------

  const saveDraft = useCallback(async () => {
    try {
      await fetch(`/api/visits/${visitId}/draft`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values, generalFeedback, verbatim, audioDurationS }),
      });
      setDraftSavedAt(Date.now());
    } catch {
      // Autosave failures are silent; the next change retries.
    }
  }, [visitId, values, generalFeedback, verbatim, audioDurationS]);

  useEffect(() => {
    if (!dirtyRef.current) return;
    const id = setTimeout(saveDraft, 900);
    return () => clearTimeout(id);
  }, [saveDraft]);

  const markDirty = () => {
    dirtyRef.current = true;
  };

  // ---- recording ------------------------------------------------------------

  useEffect(() => {
    if (rec.phase !== 'recording') return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - rec.startedAt) / 1000)), 500);
    return () => clearInterval(id);
  }, [rec]);

  async function beginRecording(target: 'general' | string) {
    setMicError(false);
    setAnalysisError(null);
    try {
      recorderRef.current = await startRecording();
      setElapsed(0);
      setRec({ phase: 'recording', target, startedAt: Date.now() });
    } catch {
      setMicError(true);
    }
  }

  async function stopRecording() {
    if (rec.phase !== 'recording' || !recorderRef.current) return;
    const target = rec.target;
    try {
      const { wav, durationS } = await recorderRef.current.stop();
      recorderRef.current = null;
      if (target === 'general') {
        setRec({ phase: 'recorded', wav, durationS, url: URL.createObjectURL(wav) });
      } else {
        // Per-field recordings analyze immediately: it is a catch-up gesture.
        await analyze(wav, durationS, target);
      }
    } catch {
      setRec({ phase: 'idle' });
      setAnalysisError(t.feedback.analysisFailed);
    }
  }

  function discardRecording() {
    if (rec.phase === 'recorded') URL.revokeObjectURL(rec.url);
    setRec({ phase: 'idle' });
  }

  // ---- analysis -------------------------------------------------------------

  async function analyze(wav: Blob, durationS: number, target: 'general' | string) {
    setRec({ phase: 'processing', target });
    setAnalysisError(null);
    try {
      const form = new FormData();
      form.append('audio', wav, 'audio.wav');
      form.append('durationS', String(durationS));
      if (target === 'general') {
        form.append('mode', 'general');
      } else {
        form.append('mode', 'field');
        form.append('fieldKey', target);
      }
      const res = await fetch(`/api/visits/${visitId}/analyze`, { method: 'POST', body: form });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as AnalyzeResponse;

      if (data.mode === 'general') {
        setVerbatim((prev) => (prev ? `${prev}\n${data.verbatim}` : data.verbatim));
        if (data.generalFeedback) setGeneralFeedback(data.generalFeedback);
        setValues((prev) => {
          const next = { ...prev };
          for (const c of criteria) {
            const analyzed = data.fields[c.key];
            if (!analyzed) continue;
            // A new general pass never touches fields the agent already confirmed.
            if (prev[c.key]?.confirmed) continue;
            next[c.key] = {
              value: analyzed.value,
              state: analyzed.state,
              confirmed: false,
              editedByAgent: false,
            };
          }
          return next;
        });
        setAudioDurationS((s) => s + durationS);
        setAnalysisDone(true);
      } else {
        setValues((prev) => ({
          ...prev,
          [data.fieldKey]: {
            value: data.field.value,
            state: data.field.state,
            confirmed: false,
            editedByAgent: false,
          },
        }));
      }
      markDirty();
      setRec({ phase: 'idle' });
    } catch {
      setAnalysisError(t.feedback.analysisFailed);
      // Keep the general recording so the agent can retry without re-dictating.
      if (target === 'general') {
        setRec({ phase: 'recorded', wav, durationS, url: URL.createObjectURL(wav) });
      } else {
        setRec({ phase: 'idle' });
      }
    }
  }

  // ---- field actions --------------------------------------------------------

  function confirmField(key: string) {
    setValues((prev) => ({
      ...prev,
      [key]: { ...prev[key], confirmed: !prev[key].confirmed },
    }));
    markDirty();
  }

  function startEdit(key: string) {
    setEditingKey(key);
    setEditText(values[key]?.value ?? '');
  }

  function saveEdit() {
    if (!editingKey) return;
    setValues((prev) => ({
      ...prev,
      [editingKey]: {
        ...prev[editingKey],
        value: editText,
        state: editText.trim() ? 'filled' : 'missing',
        editedByAgent: true,
      },
    }));
    setEditingKey(null);
    markDirty();
  }

  // ---- submit ---------------------------------------------------------------

  async function submitAll() {
    setSubmitState('submitting');
    // Confirm everything that has content, then persist and submit.
    const confirmedValues: DraftValues = {};
    for (const [k, v] of Object.entries(values)) {
      confirmedValues[k] = { ...v, confirmed: v.confirmed || v.value.trim().length > 0 };
    }
    setValues(confirmedValues);
    try {
      const draftRes = await fetch(`/api/visits/${visitId}/draft`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: confirmedValues, generalFeedback, verbatim, audioDurationS }),
      });
      if (!draftRes.ok) throw new Error('Draft save failed');
      const res = await fetch(`/api/visits/${visitId}/submit`, { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      setSubmitState('done');
    } catch {
      setSubmitState('failed');
    }
  }

  // ---- render ---------------------------------------------------------------

  if (submitState === 'done') {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-moss-soft">
          <CheckIcon className="h-7 w-7 text-moss" />
        </div>
        <h1 className="mb-2 font-display text-2xl font-semibold">{t.feedback.doneTitle}</h1>
        <p className="mb-8 text-sm text-stone">{t.feedback.doneBody}</p>
        <Link
          href="/visits"
          className="flex h-12 items-center rounded-card bg-ink px-6 font-medium text-paper"
        >
          {t.feedback.backToVisits}
        </Link>
      </main>
    );
  }

  const processing = rec.phase === 'processing';
  const generalBusy = processing && rec.target === 'general';

  return (
    <main className="pb-32">
      {/* Header */}
      <header className="px-5 pb-4 pt-5">
        <Link href="/visits" className="text-sm text-pine underline underline-offset-2">
          ← {t.feedback.backToList}
        </Link>
        <h1 className="mt-3 font-display text-2xl font-semibold leading-snug">{address}</h1>
        <p className="mt-1 text-sm text-stone">
          {prospectName} · {date}, <span className="tnum">{time}</span>
        </p>
      </header>

      <div className="space-y-4 px-5">
        {/* Points to cover */}
        <section className="rounded-card border border-line bg-surface p-4">
          <p className="overline-label mb-2">{t.feedback.pointsToCover}</p>
          <ol className="space-y-1.5 text-sm">
            {criteria.map((c, i) => (
              <li key={c.key} className="flex gap-2">
                <span className="tnum font-display font-semibold text-pine">{i + 1}.</span>
                {c.hint}
              </li>
            ))}
          </ol>
        </section>

        {/* General recorder */}
        <section className="rounded-card border border-line bg-surface p-4 text-center">
          {rec.phase === 'idle' && !generalBusy && (
            <>
              <p className="mb-4 text-sm text-stone">{t.feedback.recordCta}</p>
              <button
                type="button"
                onClick={() => beginRecording('general')}
                disabled={processing}
                className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full bg-brick text-paper disabled:opacity-50"
                aria-label={t.feedback.startRecording}
              >
                <MicIcon className="h-8 w-8" />
              </button>
              <p className="mt-3 text-sm font-medium">{t.feedback.startRecording}</p>
            </>
          )}

          {rec.phase === 'recording' && rec.target === 'general' && (
            <>
              <p className="mb-3 font-display text-3xl font-semibold tnum text-brick">
                {formatElapsed(elapsed)}
              </p>
              <button
                type="button"
                onClick={stopRecording}
                className="recording-pulse mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full bg-brick text-paper"
                aria-label={t.feedback.stopRecording}
              >
                <StopIcon className="h-7 w-7" />
              </button>
              <p className="mt-3 text-sm font-medium">
                {t.feedback.recording} — {t.feedback.stopRecording.toLowerCase()}
              </p>
            </>
          )}

          {rec.phase === 'recorded' && (
            <>
              <audio controls src={rec.url} className="mx-auto mb-4 w-full" />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={discardRecording}
                  className="h-12 flex-1 rounded-card border border-line bg-surface text-sm font-medium"
                >
                  {t.feedback.redo}
                </button>
                <button
                  type="button"
                  onClick={() => analyze(rec.wav, rec.durationS, 'general')}
                  className="h-12 flex-[2] rounded-card bg-ink text-sm font-medium text-paper"
                >
                  {t.feedback.confirmRecording}
                </button>
              </div>
            </>
          )}

          {generalBusy && (
            <div className="py-4">
              <Spinner />
              <p className="mt-3 text-sm text-stone">{t.feedback.processing}</p>
            </div>
          )}

          {micError && <p className="mt-3 text-sm text-brick">{t.feedback.micDenied}</p>}
          {analysisError && <p className="mt-3 text-sm text-brick">{analysisError}</p>}
          {analysisDone && rec.phase === 'idle' && !analysisError && (
            <p className="mt-3 text-sm font-medium text-moss">{t.feedback.fieldsFilled}</p>
          )}
        </section>

        {/* Criterion fields */}
        {criteria.map((c) => {
          const v = values[c.key];
          const isEditing = editingKey === c.key;
          const fieldBusy = processing && rec.target === c.key;
          const fieldRecording = rec.phase === 'recording' && rec.target === c.key;
          const needsAttention = v.state !== 'filled' && !v.confirmed;
          return (
            <section
              key={c.key}
              className={`rounded-card border p-4 ${
                v.confirmed
                  ? 'border-pine/40 bg-pine-soft'
                  : needsAttention && analysisDone
                    ? 'border-line bg-amber-soft/40'
                    : 'border-line bg-surface'
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="overline-label">{c.label}</p>
                {fieldRecording ? (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="recording-pulse flex h-9 w-9 items-center justify-center rounded-full bg-brick text-paper"
                    aria-label={t.feedback.stopRecording}
                  >
                    <StopIcon className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => beginRecording(c.key)}
                    disabled={processing || rec.phase !== 'idle'}
                    title={t.feedback.fieldMicHint}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-pine disabled:opacity-40"
                    aria-label={`${t.feedback.fieldMicHint}: ${c.label}`}
                  >
                    <MicIcon className="h-4 w-4" />
                  </button>
                )}
              </div>

              {fieldBusy ? (
                <p className="text-sm text-stone">{t.feedback.processingField}</p>
              ) : isEditing ? (
                <>
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={3}
                    className="w-full rounded-card border border-line bg-surface p-3 text-[15px] outline-none focus:border-pine focus:ring-2 focus:ring-pine/30"
                    placeholder={t.feedback.typeHere}
                    autoFocus
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingKey(null)}
                      className="h-10 flex-1 rounded-card border border-line text-sm font-medium"
                    >
                      {t.feedback.cancelEdit}
                    </button>
                    <button
                      type="button"
                      onClick={saveEdit}
                      className="h-10 flex-1 rounded-card bg-ink text-sm font-medium text-paper"
                    >
                      {t.feedback.saveEdit}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {v.value ? (
                    <p className="text-[15px] leading-relaxed">{v.value}</p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEdit(c.key)}
                      className="w-full rounded-card border border-dashed border-line px-3 py-3 text-left text-sm text-stone"
                    >
                      {t.feedback.typeHere}
                    </button>
                  )}

                  {v.state === 'incomplete' && (
                    <p className="mt-2 text-xs font-medium text-amber">● {t.feedback.incomplete}</p>
                  )}
                  {v.state === 'missing' && analysisDone && (
                    <p className="mt-2 text-xs font-medium text-amber">● {t.feedback.missing}</p>
                  )}

                  {v.value && (
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => confirmField(c.key)}
                        className={`flex h-10 flex-1 items-center justify-center gap-1.5 rounded-card text-sm font-medium ${
                          v.confirmed
                            ? 'bg-pine text-paper'
                            : 'border border-pine text-pine'
                        }`}
                      >
                        <CheckIcon className="h-4 w-4" />
                        {v.confirmed ? t.feedback.confirmed : t.feedback.confirm}
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(c.key)}
                        className="flex h-10 w-12 items-center justify-center rounded-card border border-line text-stone"
                        aria-label={`${t.feedback.edit}: ${c.label}`}
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
          );
        })}

        {/* General feedback */}
        <section className="rounded-card border border-line bg-surface p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="overline-label">{t.feedback.generalFeedback}</p>
            <button
              type="button"
              onClick={() => {
                setEditingKey('__general');
                setEditText(generalFeedback);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-stone"
              aria-label={`${t.feedback.edit}: ${t.feedback.generalFeedback}`}
            >
              <PencilIcon className="h-4 w-4" />
            </button>
          </div>
          {editingKey === '__general' ? (
            <>
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={3}
                className="w-full rounded-card border border-line bg-surface p-3 text-[15px] outline-none focus:border-pine focus:ring-2 focus:ring-pine/30"
                autoFocus
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingKey(null)}
                  className="h-10 flex-1 rounded-card border border-line text-sm font-medium"
                >
                  {t.feedback.cancelEdit}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGeneralFeedback(editText);
                    setEditingKey(null);
                    markDirty();
                  }}
                  className="h-10 flex-1 rounded-card bg-ink text-sm font-medium text-paper"
                >
                  {t.feedback.saveEdit}
                </button>
              </div>
            </>
          ) : (
            <p className={`text-[15px] leading-relaxed ${generalFeedback ? '' : 'text-stone'}`}>
              {generalFeedback || t.feedback.typeHere}
            </p>
          )}
        </section>

        {/* Verbatim */}
        {verbatim && (
          <section className="rounded-card border border-line bg-paper p-4">
            <p className="overline-label mb-2">{t.feedback.verbatim}</p>
            <p className="font-display text-[15px] italic leading-relaxed text-stone">
              “{verbatim}”
            </p>
            <p className="mt-2 text-xs text-stone">{t.feedback.verbatimNote}</p>
          </section>
        )}
      </div>

      {/* Sticky bottom bar */}
      <div className="bottom-bar-shadow fixed inset-x-0 bottom-0 z-10 mx-auto max-w-[480px] border-t border-line bg-surface px-5 pb-6 pt-3">
        {submitState === 'failed' && (
          <p className="mb-2 text-center text-xs font-medium text-brick">{t.feedback.submitFailed}</p>
        )}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={submitAll}
            disabled={submitState === 'submitting' || processing || !hasAnyContent(values, generalFeedback)}
            className="h-12 flex-1 rounded-card bg-ink text-base font-medium text-paper disabled:opacity-50"
          >
            {submitState === 'submitting'
              ? t.feedback.submitting
              : submitState === 'failed'
                ? t.feedback.retry
                : t.feedback.confirmAll}
          </button>
        </div>
        {draftSavedAt && submitState === 'idle' && (
          <p className="mt-1.5 text-center text-xs text-stone">{t.feedback.draftSaved}</p>
        )}
      </div>
    </main>
  );
}

function hasAnyContent(values: DraftValues, generalFeedback: string): boolean {
  return generalFeedback.trim().length > 0 || Object.values(values).some((v) => v.value.trim().length > 0);
}

function formatElapsed(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function Spinner() {
  return (
    <div
      className="mx-auto h-8 w-8 animate-spin rounded-full border-[3px] border-line border-t-pine"
      role="status"
      aria-label="Loading"
    />
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

function StopIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className}>
      <path d="M4 12.5l5 5L20 6.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1z" strokeLinejoin="round" />
    </svg>
  );
}
