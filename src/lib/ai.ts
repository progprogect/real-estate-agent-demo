/**
 * AI pipeline: transcription + analysis, both on OpenAI.
 *
 * Models are configuration, not code (a brief requirement):
 * - TRANSCRIPTION_MODEL runs on the speech-to-text endpoint (Whisper family).
 * - ANALYSIS_MODEL runs on chat completions and structures the transcript.
 * - MOCK_AI=true, or no API key at all, serves deterministic canned output so
 *   the whole flow stays demonstrable offline.
 *
 * Analysis is cumulative: every take is handed the full accumulated transcript
 * plus what is currently on screen, and returns the merged result.
 */

import { LANGUAGE_NAMES, type CriterionType, type FieldState, type OutputLanguage } from '@/lib/types';

export type CriterionDef = {
  key: string;
  label: string;
  hint: string;
  type: CriterionType;
  options: string[];
  ratingMax: number;
};

export type AnalyzedField = { value: string; state: FieldState };

/** What the agent already has on screen, fed back in so takes can build on it. */
export type ExistingField = { value: string; confirmed: boolean };

const OPENAI_BASE = 'https://api.openai.com/v1';

function env(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

function apiKey(): string {
  return env('OPENAI_API_KEY').trim();
}

function mockEnabled(): boolean {
  return env('MOCK_AI') === 'true' || !apiKey();
}

// ---------------------------------------------------------------------------
// Transcription
// ---------------------------------------------------------------------------

export async function transcribe(audio: Buffer, format: 'wav' | 'mp3'): Promise<string> {
  if (mockEnabled()) return MOCK_VERBATIM;

  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(audio)], { type: `audio/${format}` }), `audio.${format}`);
  form.append('model', env('TRANSCRIPTION_MODEL', 'gpt-transcribe'));

  const res = await fetch(`${OPENAI_BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey()}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Transcription failed (${res.status}): ${await res.text()}`);

  const data = (await res.json()) as { text?: string };
  return (data.text ?? '').trim();
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

const BASE_RULES = `You structure a real estate agent's spoken feedback after a property viewing.

Hard rules:
- Invent nothing. A criterion the agent did not mention stays null with state "missing".
- If a criterion was mentioned but too vaguely to be usable, give your best short summary of what was said and mark state "incomplete".
- Stay in the agent's words. Rephrase only to structure; never embellish, never add judgement, and keep hedges and reservations exactly as expressed.
- Free-text values are short: one to three sentences.`;

const MERGE_RULES = `The agent may record several times. You are given everything said so far and the values currently on screen.
- Keep an existing value when the new material adds nothing to it: return it unchanged.
- When the new material adds detail, extend the value so it covers everything said about that criterion.
- When the new material corrects something, replace the value with the corrected version.
- A value that was incomplete and is now covered becomes "filled".`;

function languageRule(language: OutputLanguage): string {
  if (language === 'auto') {
    return '- Write field values in the same language the agent spoke.';
  }
  return `- Write every field value in ${LANGUAGE_NAMES[language]}, whatever language the agent spoke. Translate faithfully: keep the agent's hedges and reservations, add nothing.`;
}

function shapeRule(criteria: CriterionDef[]): string {
  const lines = criteria.map((c) => {
    if (c.type === 'rating') {
      return `- "${c.key}" is a rating: value must be a whole number from 1 to ${c.ratingMax}, written as a string. Only rate what the agent actually expressed; if they did not, state is "missing".`;
    }
    if (c.type === 'choice') {
      return `- "${c.key}" is a choice: value must be exactly one of ${JSON.stringify(c.options)}. If nothing said matches one of those, state is "missing".`;
    }
    return `- "${c.key}" is free text.`;
  });
  return lines.join('\n');
}

function describeCriteria(criteria: CriterionDef[]): string {
  return criteria
    .map((c) => `- key: ${c.key} — ${c.hint || c.label}`)
    .join('\n');
}

function describeExisting(
  criteria: CriterionDef[],
  existing: Record<string, ExistingField>
): string {
  const lines = criteria.map((c) => {
    const cur = existing[c.key];
    if (!cur || !cur.value) return `- ${c.key}: (empty)`;
    return `- ${c.key}: ${cur.value}`;
  });
  return lines.join('\n');
}

const RESPONSE_SHAPE = `Respond with a single JSON object in this exact shape:
{"criteria": {"<key>": {"value": "<string or null>", "state": "filled" | "incomplete" | "missing"}}, "general_feedback": "<one or two sentence overall summary in the agent's words, or empty string>"}`;

export async function analyzeGeneral(
  fullVerbatim: string,
  criteria: CriterionDef[],
  existing: Record<string, ExistingField>,
  language: OutputLanguage
): Promise<{ fields: Record<string, AnalyzedField>; generalFeedback: string }> {
  if (mockEnabled()) return mockGeneralAnalysis(criteria, existing);

  const system = [
    BASE_RULES,
    languageRule(language),
    '',
    MERGE_RULES,
    '',
    'Field shapes:',
    shapeRule(criteria),
    '',
    RESPONSE_SHAPE,
  ].join('\n');

  const user = [
    'Configured criteria:',
    describeCriteria(criteria),
    '',
    'Values currently on screen:',
    describeExisting(criteria, existing),
    '',
    'Everything the agent has dictated so far, in order (verbatim):',
    `"""${fullVerbatim}"""`,
    '',
    'Return the merged result for every criterion.',
  ].join('\n');

  const parsed = parseAnalysisJson(await chat(system, user));

  const fields: Record<string, AnalyzedField> = {};
  for (const c of criteria) {
    fields[c.key] = normalizeField(parsed.criteria?.[c.key], c);
  }
  return { fields, generalFeedback: parsed.general_feedback ?? '' };
}

export async function analyzeField(
  verbatim: string,
  criterion: CriterionDef,
  existingValue: string,
  language: OutputLanguage
): Promise<AnalyzedField> {
  if (mockEnabled()) return mockFieldAnalysis(criterion, existingValue);

  const system = [
    BASE_RULES,
    languageRule(language),
    '',
    MERGE_RULES,
    '',
    'Field shapes:',
    shapeRule([criterion]),
    '',
    RESPONSE_SHAPE,
  ].join('\n');

  const user = [
    'Single criterion:',
    `- key: ${criterion.key} — ${criterion.hint || criterion.label}`,
    '',
    `Value currently on screen: ${existingValue || '(empty)'}`,
    '',
    'The agent recorded an addition for THIS criterion only:',
    `"""${verbatim}"""`,
    '',
    'Return JSON for this one key only. general_feedback must be an empty string.',
  ].join('\n');

  const parsed = parseAnalysisJson(await chat(system, user));
  const field = normalizeField(parsed.criteria?.[criterion.key], criterion);
  // A per-field top-up that produced nothing usable is a prompt to try again,
  // not a reason to wipe what the agent already had.
  if (field.state === 'missing' && existingValue) {
    return { value: existingValue, state: 'incomplete' };
  }
  return field;
}

/** Keeps the model inside the shape the criterion promises. */
function normalizeField(
  entry: { value: string | null; state: FieldState } | undefined,
  criterion: CriterionDef
): AnalyzedField {
  const raw = (entry?.value ?? '').toString().trim();
  if (!raw || entry?.state === 'missing') return { value: '', state: 'missing' };

  if (criterion.type === 'rating') {
    const n = Math.round(Number(raw.replace(/[^0-9.]/g, '')));
    if (!Number.isFinite(n) || n < 1 || n > criterion.ratingMax) {
      return { value: '', state: 'missing' };
    }
    return { value: String(n), state: 'filled' };
  }

  if (criterion.type === 'choice') {
    const match = criterion.options.find((o) => o.toLowerCase() === raw.toLowerCase());
    if (!match) return { value: '', state: 'missing' };
    return { value: match, state: 'filled' };
  }

  return { value: raw, state: entry?.state === 'incomplete' ? 'incomplete' : 'filled' };
}

// ---------------------------------------------------------------------------
// Shared plumbing
// ---------------------------------------------------------------------------

async function chat(system: string, user: string): Promise<string> {
  // Medium is the quality/latency sweet spot here: on a 90-second dictation
  // "high" took ten seconds longer and returned the same field values, while
  // "low" summarised the agent's hedges more tersely. Set REASONING_EFFORT to
  // "" when pointing ANALYSIS_MODEL at a model without the parameter.
  const reasoningEffort = env('REASONING_EFFORT', 'medium');

  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json',
    },
    // No temperature: the reasoning models accept only their default, and the
    // rules above are what keeps the output stable.
    body: JSON.stringify({
      model: env('ANALYSIS_MODEL', 'gpt-5'),
      response_format: { type: 'json_object' },
      ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Analysis failed (${res.status}): ${await res.text()}`);

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Analysis returned an empty response');
  return content;
}

type ParsedAnalysis = {
  criteria?: Record<string, { value: string | null; state: FieldState }>;
  general_feedback?: string;
};

function parseAnalysisJson(raw: string): ParsedAnalysis {
  const cleaned = raw.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Analysis response was not valid JSON');
  return JSON.parse(cleaned.slice(start, end + 1)) as ParsedAnalysis;
}

// ---------------------------------------------------------------------------
// Mock provider (offline demo, mirrors the worked example in the brief)
// ---------------------------------------------------------------------------

const MOCK_VERBATIM =
  "Well, yeah, it went pretty well. I'm not sure she's ready to buy, I can't really tell. " +
  'She seemed to have some doubts, but she still asked a lot of questions, so I think she is interested.';

function mockValueFor(criterion: CriterionDef, canned: string): AnalyzedField {
  if (criterion.type === 'rating') return { value: String(Math.ceil(criterion.ratingMax / 2)), state: 'filled' };
  if (criterion.type === 'choice') {
    return criterion.options.length
      ? { value: criterion.options[0], state: 'filled' }
      : { value: '', state: 'missing' };
  }
  return { value: canned, state: 'filled' };
}

function mockGeneralAnalysis(criteria: CriterionDef[], existing: Record<string, ExistingField>) {
  const canned: Record<string, string> = {
    buying_readiness:
      'Not certain. The agent senses doubts about her ability to commit, but she asked a lot of questions: genuine interest, decision not yet made.',
    visit_appreciation: 'Yes, the viewing went pretty well according to the agent.',
  };
  const fields: Record<string, AnalyzedField> = {};
  for (const c of criteria) {
    const previous = existing[c.key]?.value;
    if (canned[c.key]) {
      fields[c.key] = mockValueFor(c, canned[c.key]);
    } else if (previous) {
      fields[c.key] = { value: previous, state: 'filled' };
    } else {
      fields[c.key] = { value: '', state: 'missing' };
    }
  }
  return {
    fields,
    generalFeedback:
      'A positive viewing overall. The prospect showed interest by asking many questions but remains hesitant about going ahead.',
  };
}

function mockFieldAnalysis(criterion: CriterionDef, existingValue: string): AnalyzedField {
  const added = `The prospect reacted with reservations but stayed engaged (added detail for "${criterion.label}").`;
  return mockValueFor(criterion, existingValue ? `${existingValue} ${added}` : added);
}
