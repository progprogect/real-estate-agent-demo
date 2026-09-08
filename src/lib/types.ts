export type FieldState = 'filled' | 'incomplete' | 'missing';

export type CriterionType = 'text' | 'rating' | 'choice';

export type DraftFieldValue = {
  value: string;
  state: FieldState;
  confirmed: boolean;
  editedByAgent: boolean;
  /** Set when a later take changed a value that already had content. */
  updated?: boolean;
};

/** Criterion key -> value entry, persisted as JSON on FeedbackDraft.values */
export type DraftValues = Record<string, DraftFieldValue>;

export type CriterionView = {
  key: string;
  label: string;
  hint: string;
  type: CriterionType;
  options: string[];
  ratingMax: number;
};

export type TakeView = {
  index: number;
  mode: string;
  fieldKey: string | null;
  durationS: number;
  verbatim: string;
};

export type AnalyzeResponse =
  | {
      mode: 'general';
      take: TakeView;
      verbatim: string;
      generalFeedback: string;
      fields: Record<string, { value: string; state: FieldState }>;
    }
  | {
      mode: 'field';
      take: TakeView;
      fieldKey: string;
      field: { value: string; state: FieldState };
    };

export const OUTPUT_LANGUAGES = [
  { code: 'auto', label: 'Same as spoken' },
  { code: 'fr', label: 'French' },
  { code: 'nl', label: 'Dutch' },
  { code: 'en', label: 'English' },
] as const;

export type OutputLanguage = (typeof OUTPUT_LANGUAGES)[number]['code'];

export const LANGUAGE_NAMES: Record<Exclude<OutputLanguage, 'auto'>, string> = {
  fr: 'French',
  nl: 'Dutch',
  en: 'English',
};
