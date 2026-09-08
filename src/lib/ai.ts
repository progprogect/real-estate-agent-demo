/**
 * AI pipeline: transcription + analysis.
 *
 * Providers are configuration, not code (a brief requirement):
 * - MOCK_AI=true            -> deterministic canned output, no keys needed (offline demo).
 * - OPENAI_API_KEY set      -> transcription via OpenAI's dedicated speech-to-text
 *                              endpoint (Whisper family). Optional: OpenRouter does not
 *                              proxy that endpoint, so it is the only route to Whisper.
 * - otherwise               -> transcription via an audio-capable chat model on
 *                              OpenRouter (OpenAI's own audio models included), which
 *                              keeps the whole app on a single key.
 * - Analysis always runs on ANALYSIS_MODEL via OpenRouter.
 */

export type CriterionDef = { key: string; label: string; hint: string };

export type FieldState = 'filled' | 'incomplete' | 'missing';

export type AnalyzedField = { value: string; state: FieldState };

export type AnalysisResult = {
  verbatim: string;
  generalFeedback: string;
  fields: Record<string, AnalyzedField>;
};

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function env(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

function mockEnabled(): boolean {
  return env('MOCK_AI') === 'true' || (!env('OPENROUTER_API_KEY') && !env('OPENAI_API_KEY'));
}

// ---------------------------------------------------------------------------
// Transcription
// ---------------------------------------------------------------------------

export async function transcribe(audio: Buffer, mimeFormat: 'wav' | 'mp3'): Promise<string> {
  if (mockEnabled()) return MOCK_VERBATIM;

  const openaiKey = env('OPENAI_API_KEY');
  if (openaiKey) return transcribeOpenAI(audio, mimeFormat, openaiKey);
  return transcribeOpenRouter(audio, mimeFormat);
}

async function transcribeOpenAI(audio: Buffer, format: string, key: string): Promise<string> {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(audio)], { type: `audio/${format}` }), `audio.${format}`);
  form.append('model', env('OPENAI_TRANSCRIPTION_MODEL', 'gpt-4o-transcribe'));
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Transcription failed (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { text: string };
  return data.text.trim();
}

async function transcribeOpenRouter(audio: Buffer, format: 'wav' | 'mp3'): Promise<string> {
  const body = {
    model: env('TRANSCRIPTION_MODEL', 'openai/gpt-audio'),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              'Transcribe this audio verbatim, in the language spoken. ' +
              'Return only the transcription text, nothing else. Keep hesitations and hedges as spoken.',
          },
          { type: 'input_audio', input_audio: { data: audio.toString('base64'), format } },
        ],
      },
    ],
  };
  const content = await callOpenRouter(body);
  return content.trim();
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

Respond with a single JSON object, no markdown fences, in this exact shape:
{"criteria": {"<key>": {"value": "<string or null>", "state": "filled" | "incomplete" | "missing"}}, "general_feedback": "<one or two sentence overall summary in the agent's words, or empty string>"}`;

export async function analyzeGeneral(
  verbatim: string,
  criteria: CriterionDef[]
): Promise<{ fields: Record<string, AnalyzedField>; generalFeedback: string }> {
  if (mockEnabled()) return mockGeneralAnalysis(criteria);

  const criteriaList = criteria
    .map((c) => `- key: ${c.key} — ${c.hint}`)
    .join('\n');
  const user = `Configured criteria:\n${criteriaList}\n\nAgent's dictated feedback (verbatim):\n"""${verbatim}"""`;
  const raw = await callOpenRouter({
    model: env('ANALYSIS_MODEL', 'anthropic/claude-sonnet-5'),
    messages: [
      { role: 'system', content: ANALYSIS_RULES },
      { role: 'user', content: user },
    ],
    temperature: 0.2,
  });
  const parsed = parseAnalysisJson(raw);
  const fields: Record<string, AnalyzedField> = {};
  for (const c of criteria) {
    const entry = parsed.criteria?.[c.key];
    if (entry && entry.value && entry.state !== 'missing') {
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

  const user = `Single criterion:\n- key: ${criterion.key} — ${criterion.hint}\n\nThe agent recorded an addition for THIS criterion only:\n"""${verbatim}"""\n\nReturn JSON for this one key only. general_feedback must be an empty string.`;
  const raw = await callOpenRouter({
    model: env('ANALYSIS_MODEL', 'anthropic/claude-sonnet-5'),
    messages: [
      { role: 'system', content: ANALYSIS_RULES },
      { role: 'user', content: user },
    ],
    temperature: 0.2,
  });
  const parsed = parseAnalysisJson(raw);
  const entry = parsed.criteria?.[criterion.key];
  if (entry && entry.value) {
    return { value: entry.value, state: entry.state === 'incomplete' ? 'incomplete' : 'filled' };
  }
  return { value: '', state: 'incomplete' };
}

// ---------------------------------------------------------------------------
// Shared plumbing
// ---------------------------------------------------------------------------

type OpenRouterBody = Record<string, unknown>;

async function callOpenRouter(body: OpenRouterBody): Promise<string> {
  const key = env('OPENROUTER_API_KEY');
  if (!key) throw new Error('OPENROUTER_API_KEY is not set');
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'X-Title': 'Visit Feedback App',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`AI request failed (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('AI returned an empty response');
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
  if (start === -1 || end === -1) throw new Error('AI response was not valid JSON');
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
