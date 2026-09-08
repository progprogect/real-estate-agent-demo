/**
 * AI pipeline: transcription + analysis, both on OpenAI.
 *
 * Models are configuration, not code (a brief requirement):
 * - TRANSCRIPTION_MODEL runs on the speech-to-text endpoint (Whisper family).
 * - ANALYSIS_MODEL runs on chat completions and structures the transcript.
 * - MOCK_AI=true, or no API key at all, serves deterministic canned output so
 *   the whole flow stays demonstrable offline.
 */

export type CriterionDef = { key: string; label: string; hint: string };

export type FieldState = 'filled' | 'incomplete' | 'missing';

export type AnalyzedField = { value: string; state: FieldState };

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

const ANALYSIS_RULES = `You structure a real estate agent's spoken feedback after a property viewing.

Hard rules:
- Invent nothing. A criterion the agent did not mention stays null with state "missing".
- If a criterion was mentioned but too vaguely to be usable, give your best short summary of what was said and mark state "incomplete".
- Stay in the agent's words. Rephrase only to structure; never embellish, never add judgement, and keep hedges and reservations exactly as expressed.
- Write field values in the same language the agent spoke.
- Values are short: one to three sentences.

Respond with a single JSON object in this exact shape:
{"criteria": {"<key>": {"value": "<string or null>", "state": "filled" | "incomplete" | "missing"}}, "general_feedback": "<one or two sentence overall summary in the agent's words, or empty string>"}`;

export async function analyzeGeneral(
  verbatim: string,
  criteria: CriterionDef[]
): Promise<{ fields: Record<string, AnalyzedField>; generalFeedback: string }> {
  if (mockEnabled()) return mockGeneralAnalysis(criteria);

  const criteriaList = criteria.map((c) => `- key: ${c.key} — ${c.hint}`).join('\n');
  const raw = await chat(
    `Configured criteria:\n${criteriaList}\n\nAgent's dictated feedback (verbatim):\n"""${verbatim}"""`
  );
  const parsed = parseAnalysisJson(raw);

  const fields: Record<string, AnalyzedField> = {};
  for (const c of criteria) {
    const entry = parsed.criteria?.[c.key];
    if (entry?.value && entry.state !== 'missing') {
      fields[c.key] = { value: entry.value, state: entry.state === 'incomplete' ? 'incomplete' : 'filled' };
    } else {
      fields[c.key] = { value: '', state: 'missing' };
    }
  }
  return { fields, generalFeedback: parsed.general_feedback ?? '' };
}

export async function analyzeField(
  verbatim: string,
  criterion: CriterionDef
): Promise<AnalyzedField> {
  if (mockEnabled()) return mockFieldAnalysis(criterion);

  const raw = await chat(
    `Single criterion:\n- key: ${criterion.key} — ${criterion.hint}\n\n` +
      `The agent recorded an addition for THIS criterion only:\n"""${verbatim}"""\n\n` +
      'Return JSON for this one key only. general_feedback must be an empty string.'
  );
  const parsed = parseAnalysisJson(raw);
  const entry = parsed.criteria?.[criterion.key];
  if (entry?.value) {
    return { value: entry.value, state: entry.state === 'incomplete' ? 'incomplete' : 'filled' };
  }
  return { value: '', state: 'incomplete' };
}

// ---------------------------------------------------------------------------
// Shared plumbing
// ---------------------------------------------------------------------------

async function chat(userMessage: string): Promise<string> {
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
      messages: [
        { role: 'system', content: ANALYSIS_RULES },
        { role: 'user', content: userMessage },
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

function mockGeneralAnalysis(criteria: CriterionDef[]) {
  const canned: Record<string, AnalyzedField> = {
    buying_readiness: {
      value:
        'Not certain. The agent senses doubts about her ability to commit, but she asked a lot of questions: genuine interest, decision not yet made.',
      state: 'filled',
    },
    visit_appreciation: {
      value: 'Yes, the viewing went pretty well according to the agent.',
      state: 'filled',
    },
  };
  const fields: Record<string, AnalyzedField> = {};
  for (const c of criteria) {
    fields[c.key] = canned[c.key] ?? { value: '', state: 'missing' };
  }
  return {
    fields,
    generalFeedback:
      'A positive viewing overall. The prospect showed interest by asking many questions but remains hesitant about going ahead.',
  };
}

function mockFieldAnalysis(criterion: CriterionDef): AnalyzedField {
  return {
    value: `The prospect reacted with reservations but stayed engaged (added detail for "${criterion.label}").`,
    state: 'filled',
  };
}
