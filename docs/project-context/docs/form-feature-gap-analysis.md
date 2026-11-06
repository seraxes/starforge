# Form feature gap analysis — Starforge Core vs RSForm-style builders

**Lens:** Starforge Forms as ~70% shared platform engine (contact / survey / ticket intake / registration seeds). Compare to **RSForm! Pro** (primary), with a light **Gravity Forms**-class cross-check. Prioritize what Core must own — not every enterprise checkbox. ASN keeps commerce / domain workflows.

**Sources (not guesswork):**
- Code on `main` @ `ea77687` — `src/core/forms/*`, `src/app/(frontend)/app/admin/forms/*`, `src/modules/form/FormWidget.tsx`
- Plans / prefs: [form-engine-plan](./form-engine-plan.md), [core-modules-inventory](./core-modules-inventory.md), [preferences](../preferences.md)
- RSForm! Pro public feature surface (fields, conditionals, multipage, payments plugins, submissions export/PDF, captcha, i18n, grid)

---

## 1. What we have now

### Engine model
- **Canonical** flat `FormFieldDef[]` + optional `FormSectionDef[]` (grouping / order only — not layout rows/%).
- Derived editable **JSON Schema** (`fieldsToJsonSchema`, `x-sf-*` extensions); submit path runs `evaluateAndValidateFields` (named `validateFieldsWithZod` but runtime is evaluate, not a Zod object graph).
- Definitions in `sf_forms`; module defaults in `sf_form_settings`; submissions in `sf_form_submissions` (`definition_id`, JSON string payload, IP/UA).
- Particle `form` binds `formId` (legacy inline fields still work). Module gate: `product:forms`.

### Field types (builder palette)
`text`, `email`, `textarea`, `number`, `tel`, `url`, `select`, `radio`, `checkbox`, `checkbox-group`, `date`, `time`, `datetime`, `computed`.

**Not present as types:** file/upload, hidden, password, HTML/static content, pagebreak, signature, range, survey matrix, payment/product fields.

### Conditional logic (verified in `logic.ts` + field cog)
Per-field `logic.showWhen` / `logic.requireWhen`:
- Groups: `and` | `or`
- Ops: `eq`, `neq`, `in`, `notIn`, `empty`, `notEmpty`, `gt`/`gte`/`lt`/`lte` (numeric), `contains`
- Live in `FormWidget` via `computeLiveValues`; submit clears / skips hidden; required follows visibility
- **Scope today:** field-level only (no page/section-level conditions, no “disable” / “set value” actions)

### Math / calculations (verified in `expr.ts` + `evaluate.ts` + field Math panel)
Safe parser (no `eval`): `+ - * /`, comparisons (`== != < > <= >=`), functions `sum` / `min` / `max` / `abs` / `round`.
Used by:
- `computed` fields (server recomputes; client display)
- `numberBounds.minExpr` / `maxExpr`
- `validateExpr` (truthy check + message)

### Validation
- Required (static + `requireWhen`)
- Built-in: email regex, URL parse, number finite, option whitelist, date/time constraints (min/max, weekdays, daysOfMonth)
- Expression bounds + `validateExpr`
- **Missing:** arbitrary regex/pattern, min/max length, password rules, unique-among-submissions, AJAX “unique email”, etc.

### Layout / builder UX
- Layout-aligned: left Fields palette, section canvas, dnd-kit reorder **within section**, field-bar cog (`ParticleSettingsPopover`), Editor / Form settings tabs, autosave + Saved toast, JSON Schema panel
- Sections = labels + ordered names; public widget renders section headings
- Plan later: cross-section field drag
- **Not RSForm grid:** no same-row %-columns inside the form; placement is Layout particle + vertical field stack

### Multi-page
**None.** Sections are visual groups on one page, not Pagebreak / wizard steps.

### Uploads / media
- **Option media** on select/radio/checkbox-group via `MediaPicker` (Payload media id + URL fallback) — decorative, not file intake
- **No** respondent file-upload field

### Email / notifications
- Per-form `emailNotify`: admin and/or respondent; subjects; admin email overrides; respondent field name
- Forms → Settings: default admin emails, from override, default success message
- Dispatch via platform **Mailer** (Site Chrome); plain-text body of payload key/values
- Soft-fail: mail errors do not fail submit

### Spam / security
- Honeypot (`website`)
- In-memory rate limit (~8 / 60s / IP+formKey) — Redis later
- Turnstile via Site Chrome captcha policy + per-form `useSiteCaptchaDefault`
- Module/particle off → submit rejected

### Submissions admin
- List page (last 100): when, formKey, definitionId, expandable payload, IP
- **No** CSV/XLS/XML export, edit, resend, delete UI, search/filter, import
- **IA note:** preferences deprecate Forms **Submissions** nav; on this `main` checkout Submissions is still in sidebar + horizontal Forms tabs. Settings exists as sidebar + deep link (horizontal nav currently Forms + Submissions only). Store/route should stay even if nav is dropped.

### Presets
- **Shipped:** `contact`, `blank`
- **Stubs** (thin seed fields only): `survey`, `event-registration`, `voting`, `ticket`

### ACL / integrations / PDF / payments
- Forms area = app-admin + module enabled (no per-form public ACL beyond Layout/Nav particle tags)
- No webhooks, CRM map, Zapier, DB mapping
- No PDF
- No payment gateways / product fields

---

## 2. Reference product feature buckets (RSForm-style)

| Bucket | RSForm! Pro (typical) | Gravity Forms–class (glance) | Starforge now |
| --- | --- | --- | --- |
| **Fields** | Large catalog (std + advanced + payment plugins) | Large catalog + addons | Lean typed set + computed; no file/hidden/HTML |
| **Layout** | DnD grid, multi-col, themes/framework CSS | Columns / page breaks | Sections + vertical stack; Layout owns page placement |
| **Validation** | Required + rule set + custom | Required + rules + GF filters | Built-ins + expr; no regex/length kit |
| **Conditionals** | Show/hide (choice-driven UI) | Show/hide/require + multi-rule | Field `showWhen`/`requireWhen` (stronger ops than basic RSForm UI) |
| **Calculations** | Calculation forms / totals | Number formulas / pricing | Computed + bounds/validateExpr (solid for Core) |
| **Multi-page** | Pagebreak + progress + per-page AJAX | Page fields | Absent (sections ≠ pages) |
| **Payments** | Stripe/PayPal/… plugins | Stripe / PayPal addons | Absent → **ASN** |
| **Uploads** | File Upload field | File Upload | Option media only |
| **Email / notifications** | Unlimited configured mails, placeholders | Multiple notifications + routing | Admin + respondent via Mailer (plain text) |
| **Spam** | Captcha / reCAPTCHA / invisible | honeypot, captcha, Akismet | Honeypot + rate limit + Turnstile |
| **Submissions / export** | Rich manage + CSV/ODS/XLS/XML + import | Entries + export | Thin list; no export |
| **PDF** | Per-submission PDF plugin | PDF addon | Absent |
| **ACL** | Joomla access on form/menu | Capabilities / logged-in | Module + admin; particle viewing via Layout/Nav tags |
| **Integrations** | Salesforce, Mailchimp, … | Zapier / webhooks / addons | None (Mailer only) |
| **UX builder** | Component list + properties + grid | Editor + settings | Layout-like palette/canvas/cog (intentionally) |

---

## 3. Gap table

| Missing | Priority for Starforge core | Why |
| --- | --- | --- |
| **File / media upload field** (Payload Media bind, not a second library) | **Must** | Ticket/report + event signup need attachments; plan/prefs already point at SF-28 Media |
| **Submissions IA cleanup** (drop deprecated Submissions nav; keep store + deep link or email-first ops) | **Must** | Pref already decided; current `main` still links it — hygiene before growing inbox UI |
| **Hidden field + defaultValue** | **Must** | Tracking, fixed context (page/event id), non-editable seeds without custom HTML hacks |
| **CSV export** (selected / filtered / by definition) | **Should** | Ops need data out without RSForm-class inbox; email alone is not enough for audits |
| **Pattern / minLength / maxLength validation** | **Should** | Common contact/ticket constraints; `validateExpr` is awkward for strings |
| **Cross-section field DnD** | **Should** | Plan already lists it; builder completeness vs Layout expectations |
| **Richer notify templates** (simple placeholders / HTML via Mailer helpers) | **Should** | Mailer is real; payload dump is enough for MVP, not for respondent UX |
| **Optional redirect / success URL** after submit | **Should** | Contact flows often leave the particle; success message alone is limiting |
| **One real non-contact preset** (ticket or survey seed when a surface needs it) | **Should** | Stubs exist; no new builder — thin JSON + labels only |
| **Submission detail actions** (delete, resend notify) | **Should** | Lightweight once export exists; avoid full RSForm Manage Submissions |
| **Multi-page / pagebreak + progress** | **Later** | Useful for long surveys; contact/ticket Core can stay single-page + sections |
| **Static HTML / content block field** | **Later** | Nice for legal blurbs; Custom particle / page content often covers it |
| **Per-form public ACL** (beyond Layout/Nav tags) | **Later** | Groups-on-particle already covers “who sees the form”; avoid dual ACL UIs |
| **Outbound webhook on submit** | **Later** | Inventory: on demand; first consumer Forms — not before a real integration |
| **Regex-named “unique submission” / anti-dupe** | **Later** | Edge for voting/contests; ASN/voting layer if needed |
| **Password field type** | **Later / rarely** | Auth owns passwords; form password is niche |
| **Payments / products / Stripe / PayPal** | **Later \| ASN** | Explicit ASN commerce; Core may keep `computed` totals only |
| **Event registration workflow** (capacity, tickets, seats) | **Later \| ASN** | Preset seed OK; domain logic stays ASN |
| **PDF generation / email PDF attach** | **Do not chase (Core)** | Classic RSForm upsell; export CSV + Mailer cover Core |
| **Multi-language form translations** | **Later \| platform i18n** | Defer with site i18n; do not invent form-only locale UI |
| **Framework theme packs / Bootstrap grid skins** | **Do not chase** | Public theme + Layout Styles own look |
| **Survey matrix / birthday / Google Map / range slider** | **Do not chase / ASN-later** | Rebuild with select/radio/date or app module |
| **Submission CSV import / DB mapping** | **Do not chase** | Migration tooling ≠ Core product |
| **Unlimited email designer / marketing automation** | **Do not chase** | Stay on Mailer `send()` + thin templates |
| **Zapier-class integration marketplace** | **Do not chase** | Webhook later if needed |
| **Parallel form engines (SurveyJS, etc.)** | **Do not chase** | Pref: one dnd-kit + schema engine |

---

## 4. Top recommended next slices (Core, ordered)

1. **Nav hygiene — Submissions**  
   Remove Submissions from sidebar + Forms horizontal tabs (per prefs). Keep `sf_form_submissions` + optional deep-link page. Stop investing in a second “inbox product” until export exists.

2. **File upload field → Payload Media**  
   New field type; store media id(s) in payload; size/mime via Media pipeline; builder cog + public widget. Unblocks ticket/report and many ASN presets without ASN inventing uploads.

3. **Hidden + `defaultValue`**  
   Small schema + widget + evaluate pass-through. High leverage for particle/page context and tracking.

4. **CSV export by definition**  
   Admin action on Forms list or deep-link submissions page — not Excel/PDF suite. Makes dropping the always-visible inbox tolerable.

5. **String constraints** (`pattern`, min/max length, clearer messages)  
   Complements math `validateExpr` for the common non-numeric cases.

6. **Cross-section DnD**  
   Finish Layout-parity builder polish called out in the form engine plan.

7. **Notify template placeholders** (e.g. `{name}`, `{email}`, success copy) on Mailer text/HTML helpers  
   Respondent mail quality without an email designer.

8. **Success redirect URL (optional)** + first **thin real preset** when a product page needs ticket or survey  
   Preset = seed JSON only; no second builder.

---

## 5. Do not chase (RSForm bloat / ASN-only)

- Payment packages (Stripe, PayPal, Square, iDEAL, donations, product catalogs)
- PDF plugins / per-submission PDF chrome
- Multi-framework layout skins (Bootstrap/UIkit/Foundation packs)
- Full Manage Submissions suite (edit rows, import CSV, payment status, column chooser UI)
- Survey Table / Birthday / Google Map / Range Slider as first-class Core types
- Form-level multi-language translation UI ahead of platform i18n
- Map submissions into arbitrary external DBs
- Marketing/CRM plugin zoo (Mailchimp, Salesforce, …) as Core modules
- Event capacity, seating, marketplace checkout — **ASN**
- Replacing conditional+math with SurveyJS or a second schema runtime
- Building a Zapier competitor inside Core

---

## Bottom line

Starforge Forms is already past a “contact widget”: **Layout-like builder**, solid **field conditionals**, and a real **safe math layer** are Core strengths vs many mid-tier builders’ show/hide-only logic. The meaningful Core gaps are **file intake**, **ops export / IA discipline around submissions**, and a few **schema basics** (hidden, defaults, string constraints) — not multipage/PDF/payments. Chase those slices; leave RSForm’s enterprise and commerce surface to Later or ASN.
