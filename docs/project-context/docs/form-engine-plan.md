# Modular Form engine (SF-65)

Reuse one Core Form engine for contact, survey, event registration, voting, and ticket/report intake. Prefer **dnd-kit + JSON Schema / Zod** over SurveyJS. Principle: [modular-core](../principles/modular-core.md). Builds on SF-48 (`product:forms` + Form particle + submissions + Turnstile).

## Goal

Visual Form builder in Core admin → editable field list + derived **JSON Schema** (evaluate/Zod for submit validation). Own particle/module; Site Settings on/off. Other modules call the engine via **typed presets**, not parallel field UIs. Media fields bind later to Payload media (SF-28) — no second library.

## Model

| Piece | Role |
| --- | --- |
| `FormFieldDef` | Canonical flat field list (name, label, type, required, constraints, logic, …) |
| `FormSectionDef` | Builder/public **grouping only** (ordered field names) — not layout rows/% |
| JSON Schema | Derived + editable projection (`fieldsToJsonSchema` + `x-sf-*` extensions) |
| Evaluate path | Visibility, required, date/time, math/computed, validateExpr on submit + live widget |
| `FormDefinition` | Named document in `sf_forms` (preset, title, fields, sections, schema, success, email) |
| `FormsModuleSettings` | Forms → Settings singleton (`sf_form_settings`) — email defaults, default success |
| Presets | `contact` (ship), stubs: `survey`, `event-registration`, `voting`, `ticket` |
| Particle `form` | Binds `formId` (preferred) or legacy inline fields on the slot |

## Admin UX (Layout-aligned)

**Same system feel as Layout builder — not a separate alien UI.**

| Layout pattern | Form builder analogue |
| --- | --- |
| Left **Particles** palette (`.gantry-palette`) | Left **Fields** palette (same classes) |
| Section canvas + module bars (`.gantry-section` / `.gantry-slot`) | Section groups + field bars (same chrome; vertical stack) |
| Cog / inspector | Field-bar **cog** → floating settings popover (Config / Field tabs; same `ParticleSettingsPopover` as Layout modules) |
| Outline + horizontal tabs | Forms module tabs: **Forms** / **Submissions** / **Settings** |
| Outline child panels (Layout / Styles / …) | Form edit tabs: **Editor** (palette + canvas + JSON Schema) / **Form settings** (title, success, captcha, email, …) |
| Gantry dark tokens, 4px borders, autosave + Saved toast | Reused |

**Do not force identical data model:** Layout owns sections → rows → %-width slots. Forms keep a **flat field list** as source of truth; optional `sections[]` only labels/order groups for builder + public render. Share CSS class patterns (`.gantry-editor`, `.gantry-palette`, `.gantry-section`, `.gantry-slot`) and DnD kit; do not share LayoutDocument types.

Builder: palette → section canvas (dnd-kit reorder) → field cog (not bar-click); JSON Schema panel synced on **Editor**. Form-level meta / success / email notify live on **Form settings** (not the field cog). Both edit panels stay mounted (hidden) so autosave FormData stays complete. Autosave + Saved toast; Close dismiss stays Close.

Sidebar (gated by `product:forms`): Forms · Submissions · Settings.

## Field types

text, email, textarea, number, tel, url, select, **radio**, checkbox, **checkbox-group**, **date**, **time**, **datetime**, **computed**.

### Date / time

`FormFieldDef.constraints`: inclusive `min` / `max`, optional `weekdays` (0=Sun…6=Sat), optional `daysOfMonth` (1–31). Combinations AND. JSON Schema: `format` + `x-sf-dateConstraints`.

### Conditional logic

`FormFieldDef.logic.showWhen` / `requireWhen`: condition groups (`and`/`or`) with ops eq, neq, in, notIn, empty, notEmpty, gt/gte/lt/lte, contains. Evaluated live in FormWidget and on submit (hidden fields cleared / not required). Pages/sections can reuse the same group shape later.

### Math

Safe expression parser (no `eval`): `+ - * /`, comparisons, `sum` / `min` / `max` / `abs` / `round`. Used by `computed` fields, `numberBounds.minExpr` / `maxExpr`, and `validateExpr`.

### Option media

`FormFieldOption.media`: `{ mediaId?, url?, alt?, kind? }` on select / radio / checkbox-group. Interim URL or Payload media id until SF-28 picker; public widget renders image/icon/file.

### Success + email

Per-form `successMessage` (builder). Per-form `emailNotify` + Forms → Settings defaults (`defaultAdminEmails`, `fromAddress`, `defaultSuccessMessage`). Transport **`stub`** until platform email exists — plans intents, does not send; secrets stay in env.

## Foundation shipped

1. Schema types, JSON Schema / evaluate helpers, presets + contact.
2. `sf_forms` + `sf_form_settings`; submissions `definition_id`.
3. Admin: Forms / Submissions / Settings + Layout-aligned builder.
4. Form particle binds definition; inline fallback remains.
5. Submit: evaluate → store → email stub.

## Later

- Survey / event / voting / ticket workflow layers on presets.
- File/media fields + option media picker → Payload media (SF-28).
- Real email transport (same deferral as forgot-password).
- Cross-section field drag (today: reorder within section; Add section for grouping).
- Rate-limit / captcha polish already started in SF-48.
