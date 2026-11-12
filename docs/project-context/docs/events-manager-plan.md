# Events / venues manager (Modules)

**Layer:** **Modules** (`product:events`). AI description assist uses Core **`LlmProvider`** port. ASN field/milsim semantics = **Hero** on the same entities — not an events fork ([platform-module-layers](./platform-module-layers.md)).

**Goal:** Generic **Events + venues (+ booking hooks)** as an optional **Module** pack — reusable by any Starforge site. **Hero** sites (ASN and others) add theme + vertical nouns (fields, milsim ops) on top.

**Status:** Plan only. Ship after Core ports + needed Modules (Media taxonomy, Forms presets, Redis when async needed). Toggle via Module Manager / `starforge.modules.json`.

## Scope (Module)

| Piece | Owns |
| --- | --- |
| **Venue** | Place entity: name, address text, optional geo link ([maps-location-plan](./maps-location-plan.md)), Media cover, ACL |
| **Event** | Title, schedule (start/end/tz), venue ref, status, description (rich text), Media gallery (same Payload library + tags), capacity, visibility ACL |
| **Registration** | Form engine **event-registration preset** — no parallel field builder ([preferences](../preferences.md)) |
| **Calendar / list particles** | Public/admin particles bound to Events module views; Nav can deep-link module routes |
| **Booking hooks (later)** | Optional hold/ticket ports — payments stay Marketplace/Shop adapters, not reinvented here |

## Out of scope (Hero / other Modules)

- ASN airsoft field semantics, milsim op sheets, ASN fee rules → **Hero**
- Full ticketing marketplace → Shop/Marketplace **Modules**
- Live stream embed rules → Stream **Module** + event binder later

## Data + ACL

- Store in `sf_*` or Payload collections behind the Events module — one model for all sites.
- Viewing/editing ACL = **groups** multi-tags (OR match; empty = public), same as Nav/layout/pages — no Access Level entity.
- Media: event cover + gallery = `mediaId[]` on the **same** Payload Media library; filter by shared tags/categories when taxonomy lands ([media-pipeline-plan](./media-pipeline-plan.md)).

## AI assist — event / game description drafting

Editors often need a first-draft description from title, venue, schedule, and a few bullets. Keep this **optional** and **provider-swappable** — same discipline as Mailer (Core port + Site Settings policy + env secrets; no vendor hard-coded in the Events collection).

### Easiest path (recommend)

**Optional `LlmProvider` port (Core) + Mailer-like adapters; prompt from event fields; draft inserted into the description editor; secrets in env.**

| Piece | Choice |
| --- | --- |
| **Port** | Thin `complete({ system, prompt, maxTokens }) → { text }` — one active adapter at call time (Core infrastructure port) |
| **Adapters** | `console` (dev stub), then `openai`-compatible HTTP **or** Anthropic — pick first real adapter when wiring; add others as adapters only |
| **Trigger** | Admin Event edit: **“Draft description”** button (on-demand). Never auto-overwrite saved copy |
| **Prompt** | Built from structured fields: title, venue name/address, start/end, capacity, organizer notes / bullet chips — no free-form “trust the model with the DB” |
| **Insert UX** | Draft lands in Lexical/TipTap (or textarea) as **selected insert / replace-with-confirm** — editor keeps authorship |
| **Policy** | Events module settings (or Site Settings): enable AI assist + provider enum; disabled → hide button |
| **Secrets** | `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` (etc.) in env / Environment editor only — never Site Settings DB |
| **Safety** | Rate-limit per admin; no PII in prompts beyond what the editor already typed; log failures softly |

**Why this path:** Matches Mailer port discipline; zero new UI frameworks; works for ASN game-day blurbs **and** generic meetup copy; sites without keys keep Events fully usable.

**Avoid:** Embedding a vendor SDK in the Events schema; silent auto-publish of model text; a Hero-only “ASN AI writer” that forks Events.

```ts
export type LlmCompletionInput = {
  system?: string
  prompt: string
  maxTokens?: number
}

export type LlmProvider = {
  id: string
  complete(input: LlmCompletionInput): Promise<{ text: string }>
}

/** Events module helper — builds prompt; calls active LlmProvider. */
export async function draftEventDescription(fields: {
  title: string
  venueName?: string
  venueAddress?: string
  startsAt?: string
  endsAt?: string
  notes?: string
}): Promise<string>
```

## Module shape

- Allowlist id e.g. `product:events` (+ particles `event-list`, `event-calendar`, `event-detail`).
- Depends on: Core Auth/ACL + ports; Media + Forms Modules; Mailer (confirmations later); optional Maps; optional `LlmProvider`.
- Hero: theme skins + vertical fields on the same entities — do not fork Events.

## Recurring dates (finite linked copies)

**Decision (shipped create path):** Eventbrite-style — one create expands a bounded pattern into concrete `sf_events` rows. Each date has its own capacity, registrants, and start/end. Copies share `seriesId` (usually the first occurrence’s id). Pattern JSON lives on the series root only. Not a live RRULE engine.

| Concern | Owner |
| --- | --- |
| Expand daily / weekly / monthly + interval + end (count or until) | Events create form → `createEventSeries` |
| Title, description, venue, ACL, parties, price snapshot at create | Copied onto each date |
| Start / end / slug / registration windows | Per date (windows shift with start) |
| Capacity occupancy, registrants, check-in, orders | Per date |
| Manual see-also links | `relatedEventIds` (separate from series) |
| One-off copy | Edit toolbar **Duplicate** |

**Later:** group save scopes (this / following / all), series badge polish, toolbar “extend series”, per-date price leave-series.

## Success

Any Starforge site can enable the Events Module, bind Media + Form registration, and optionally draft descriptions via a pluggable LLM port without Hero-specific code inside the module.

## Related

- [platform-module-layers](./platform-module-layers.md)
- [core-modules-inventory](./core-modules-inventory.md)
- [media-pipeline-plan](./media-pipeline-plan.md)
- [maps-location-plan](./maps-location-plan.md)
- [form-engine-plan](./form-engine-plan.md)
- [email-mailer-plan](./email-mailer-plan.md)
