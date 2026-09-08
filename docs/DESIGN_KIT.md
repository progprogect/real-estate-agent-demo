# Design Kit — "Field Ledger"

Visual system for the Visit Feedback App. The direction is a **field notebook for property professionals**: warm paper tones, deep pine green ink, a single brick-red accent reserved for recording and alerts. It deliberately avoids generic SaaS styling (purple gradients, glassmorphism, soft shadow cards, emoji) in favor of an editorial, print-inspired look.

References consulted: Mobbin real-estate & CRM mobile collections, Dribbble real-estate app tags, earth-tone palette systems (forest green / cream / terracotta pairings).

## 1. Color tokens

| Token | Hex | Usage |
|---|---|---|
| `--color-ink` | `#1E3A2B` | Primary text, headings, primary buttons |
| `--color-pine` | `#2C5240` | Interactive elements, links, active states |
| `--color-pine-soft` | `#EAF0EA` | Selected/active backgrounds, confirmed field tint |
| `--color-paper` | `#F5F2EA` | App background |
| `--color-surface` | `#FFFDF8` | Cards, sheets, inputs |
| `--color-line` | `#E2DCCC` | 1px borders, dividers |
| `--color-stone` | `#6E7468` | Secondary text, metadata |
| `--color-brick` | `#B9532F` | Record button, destructive actions, error states |
| `--color-brick-soft` | `#F6E7DF` | Error/recording backgrounds |
| `--color-amber` | `#9A7519` | Pending/incomplete warnings (text) |
| `--color-amber-soft` | `#F3ECD9` | Incomplete field tint |
| `--color-moss` | `#3F7D4E` | Success, "answered" status |

Rules:
- Never pure black (`#000`) or pure white on large areas.
- Brick is an accent: at most one brick element prominent per screen (the mic, or an error — not both styled equally).
- Status chips: amber = pending/incomplete, moss = done/confirmed, stone = expired/cancelled, brick = error.

## 2. Typography

- **Display: Fraunces** (Google Fonts) — page titles, section headers, big numerals (times, counts). Optical size on, weight 500–600. Gives the ledger/editorial character.
- **UI & body: Archivo** (Google Fonts) — everything else. Weights 400/500/600.
- Overline labels: Archivo 11px, uppercase, letter-spacing 0.08em, stone color.
- Times and counts use tabular numerals (`font-variant-numeric: tabular-nums`).
- No font below 12px.

## 3. Shape & depth

- Corner radius: **10px** for cards and inputs, **8px** for chips and small buttons, **full** only for the mic button.
- Depth via **1px solid `--color-line` borders**, not drop shadows. The only shadow allowed: the sticky bottom action bar (`0 -4px 16px rgb(30 58 43 / 0.08)`).
- Dividers inside lists: 1px dotted `--color-line`.

## 4. Layout & ergonomics (one-thumb rule)

- Max content width 480px, centered; the app is phone-first.
- Screen padding 16px; vertical rhythm on a 4px grid.
- Primary actions live in a **sticky bottom bar**; tap targets ≥ 48px.
- Visit rows: strong left rail with the time (Fraunces), content to the right, status chip on the far right.
- The general mic button: 72px circle, brick, centered in the bottom bar while recording is available; timer in Fraunces while recording.

## 5. Components

- **Status chip**: 8px radius, soft background + dark text of the same hue, 12px Archivo 500.
- **Field card**: surface background, 1px line border, overline label (criterion), body text, footer row with confirm (pine outline → filled when confirmed) and pencil edit button, plus a per-field mic.
- **Incomplete notice**: amber text, 12px, prefixed with a small dot, inside the field card — signals without blocking.
- **Buttons**: primary = ink background / paper text; secondary = surface + 1px line border + ink text; destructive = brick. 10px radius, 48px height.
- **Inputs**: surface, 1px line, 10px radius; focus ring = 2px pine, no glow.

## 6. Voice & tone (copy)

- Plain, short, task-oriented English. Sentence case everywhere ("Confirm my recording", not "CONFIRM").
- No exclamation marks, no emoji, no "AI magic" language. The system says what it did: "Fields filled from your recording. Review and confirm."
- All strings externalized (i18n-ready), English is the only shipped locale.
