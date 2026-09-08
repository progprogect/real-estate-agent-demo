export type FieldState = 'filled' | 'incomplete' | 'missing';

export type DraftFieldValue = {
  value: string;
  state: FieldState;
  confirmed: boolean;
  editedByAgent: boolean;
};

/** Criterion key -> value entry, persisted as JSON on FeedbackDraft.values */
export type DraftValues = Record<string, DraftFieldValue>;

export type CriterionView = {
  key: string;
  label: string;
  hint: string;
};

export type AnalyzeResponse =
  | {
      mode: 'general';
      verbatim: string;
      generalFeedback: string;
      fields: Record<string, { value: string; state: FieldState }>;
    }
  | {
      mode: 'field';
      fieldKey: string;
      field: { value: string; state: FieldState };
    };
