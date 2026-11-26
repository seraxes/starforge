---
kind: reference
last_verified: 2026-11-26
---
# product:onboarding — pack plan

**Status:** Proposed. **Parked** — not on the live queue (Social polish, then Marketplace first). Live map: [architecture-current](./architecture-current.md). Do not scaffold schema, admin UI, or a manifest from this plan.  
**Placement:** Advanced module (`product:onboarding`). Not Core. Not base. Not Hero.  
**Family index:** [primeone-pack-plans](./primeone-pack-plans.md).  
**Principle:** Never rebuild an existing module’s job ([modular-core](../principles/modular-core.md), [sf-module-ownership](../../../.cursor/rules/sf-module-ownership.mdc), [sf-architecture](../../../.cursor/rules/sf-architecture.mdc)).

## Goal

Onboarding collects everything the company needs before a person is employed or contracted as a sole trader (egyéni vállalkozó: tax number and registration number), then hands the active driver to Fleet.

A public application form asks for the minimum first: email, phone, and a photo. Extra fields (a CV, for example) are configured on that form. Submitting creates the Core user and signs them in. They land on the driver home. That home is an Onboarding particle in the site layout, not a second CMS. The particle reads the person’s main step and shows the blocks configured for that step: a short instruction, the progress count, the required-data icons, and the action tiles. The user menu shows the same step with its colour. A Page can sit above the particle when a step needs a longer explanation (the June article). Onboarding stores the page id and the tile list. It does not store the article.

The flow is not a fixed line. Staff set which steps unlock which other steps. One step is the person’s current main step. Other unlocked steps stay open at the same time, so documents can be uploaded before or after training. Different companies edit this graph. Each step still has one Forms definition, a setting for who may edit it, and the emails that may be sent at that step.

Managers work from one table. Each row is a person. The columns are the person, the current step, a stack of events, timestamped notes, and the log. Filters cover step, event type, event day, and open to-dos. A new applicant appears on that table live (Core RealtimePort), not only as a later refresh.

Event types are configurable. Staff can add a type, attach it to a step, and stack more than one event on the same person. The live screen’s three cards (intro day, exam day, training day) are seeded examples, not a fixed set. A hashtag on the row is a manager tag, not the main step. Tags are extra visual marks for staff: waiting on the applicant, asked for a break, not answering, or something to do. They do not move the workflow. Staff can filter the table by them.

Eredmény on the card sets the event’s own result. It does not by itself move the main step. Seeded results are confirmation email sent, no-show, completed, and successfully completed. An exam can also be unsuccessful. A later option may attach an action to a result, including pushing the main step forward. That action is not in this pass.

Each event type has a confirmation email in Email Manager. On the card, staff confirm a slot (depot, date, time, trainer) and open the filled message, edit it if needed, and send. Onboarding does not grow a second mail editor. It records the send in the log column.

Fleet uses the projected facts (driver id and the fields it is allowed to read) only once the person is active, to put that driver on vehicles.

### PrimeOne graph (the steps in use)

Other companies edit the graph. PrimeOne seeds this main line:

1. Sign up.
2. Contact made (kapcsolatfelvétel). Someone has talked to the applicant and they have the basic job information. This is a real step. Its home can show the same family of blocks as a brand-new applicant, but the tile list is still configured per step.
3. Exam day and intro-day booking.
4. Trial day: ride-along with a trainer driver. Opens after the exam day.
5. Contract. Opens after the required documents are approved.
6. Active. The home tiles switch to the driver tools (booking, my tours, calendar, training, requests, reports, ClearQuote, the courier portal). The driver facts go to Fleet.

Beside that line, on every home, the required-data icons stay visible. Each icon is one required item: station, photo, CV, sole-trader status, tax number, driving licence, ID card, address card, health booklet, contract, plus any other the company marks required. Empty means not submitted. One colour means the applicant submitted it. Green means a manager approved it. The icons do not replace the main step. They can be filled before or after the exam and the trial. The contract step waits until the required icons are green.

An active driver’s tiles may open Fleet screens. Onboarding only decides which tiles show for that step. Fleet owns the booking, tour, and calendar screens those tiles open.

## Ownership (planned)

| Owns | Consumes |
| --- | --- |
| Person workflow from invite until active driver, including **training** | **forms** (application / intake definitions; Onboarding stores workflow + definition ids, not field schemas) |
| | **pages** (the explanation above each applicant step; Onboarding stores a page id, not the article) |
| Phase, driver code, phone, chosen station id, home-run allow / free km, trainer flag, Clearquote | **media** (kept files as `mediaId`; bytes stay in Media) |
| Configurable event types, stacked on the person and tied to a step. Timestamped notes, follow-up, calls, mail log. The event result is separate from the main step. Live row updates | **email-manager** (one editable starter per step; `emitEmailTrigger`; never `getMailer()`) |
| | **Core RealtimePort** (new applicant and row changes on the table) |
| Training types, sittings, practical checklist, trainer calendar, qualification on pass. Quiz questions and the pass mark stay in Forms | **profiles** (labels / avatar; name and email stay on Core user) |
| Document slots and valid-until on licence, health booklet, contract (until Documents owns render) | **Core users** (the person is the Core user; no second account copy) |
| Status builder: named statuses, bookable flag, one Forms definition id per status | **fleet** (`optionalRequires` — station list only; no station table here) |
| Person-fact reads for Fleet (not a Core port) | **Core ACL** (`admin.onboarding`; staff bypass additive per `sf-staff-bypass`) |
| | **documents** (optional later — shared PDF / subject link when both person and car files need the same renderer) |

**Rule of thumb:** Onboarding owns the workflow graph. A person has one current main step and any parallel steps that the graph has unlocked. Each step has configurable inputs (one Forms definition) and a setting for who may edit them. Managers audit one driver: the main step, the open steps, what is filled, and what is missing. Forms owns the inputs. Onboarding does not copy them. Fleet reads only the projected person facts through this public door, and only uses them for an active driver.

## Public door (planned)

`@/modules/onboarding/api` (and `api.server` if the pack needs a server-only split). Door id: `onboarding-api`.

Planned exports (names indicative; freeze in the scaffold slice):

- Read / write identity facts for a user id (phone, driver code, bookable, home-run, trainer, Clearquote). Station id is stored here; the station list is Fleet’s
- List statuses and the Forms definition id attached to each status
- Latest training result for the person card
- Settings load/save; email seed helpers

Cross-pack callers use this door only. Private `store` / `schema` / `actions` stay inside the pack. Fleet must not import Onboarding private files.

## Domain shape (decision level — no tables yet)

Records hang on the **Core user id**. Exact `sf_onboarding_*` shapes land in a later schema slice.

| Concept | Role |
| --- | --- |
| **Step** | A node in the company-editable graph. One is the current main step. Others are parallel and stay open together once unlocked. Seed examples: application, exam day, ride-along and training week, documents (ID, licence, health certificate, sole-trader tax number and registration number), active (bookable), inactive, closed (visszautasítva), banned (kitiltva). Each step may attach one Forms definition and who may edit it: the driver, a manager, or both |
| **Identity facts** | Current status, driver code, phone, Fleet station id, home-run allow / free km, trainer flag, Clearquote |
| **Event type** | Configured catalog. Seed the live examples (intro day, exam day, training day). Each type can be tied to a step |
| **Event** | One card in the person’s stack. Dates, place, confirmation, outcome, “also counts as training”. Eredmény sets that result. Advancing the main step from a result is a later option. Not a public ticket |
| **Status form** | The application, the contract pack, training answers, and other driver data for that status. Answers stay in Forms. Onboarding stores the definition id and the current submission id |
| **Training type / sitting** | Catalog and scheduled sittings. The checklist answers are the training status form, not a second field store |
| **Trainer slot** | Calendar capacity for trainers |

Form answers stay in Forms. One current submission per person per status form. Older saves stay as history. Who may edit that submission is a setting on the status, not a second editor: the driver, a manager, or both. Forms saves the fields. Onboarding allows the edit only when the status setting and the viewer match. A file field is a Media id. Onboarding copies only the facts Fleet reads (phone, driver code, station id, and similar) when that form is saved. It does not keep a second copy of the application, the contract, or the training answers. Valid-until dates are fields on the contract form. Missing is an empty field. Expired is a date in the past.

## Rules that must survive

- **Bookable** when the current status is flagged bookable, or the user has Fleet vehicle access. Staff who book for someone else still cannot book a person who fails both.
- **Visszautasítva** = the applicant declined. **Kitiltva** = the company refused.
- A saved test or checklist does **not** change the phase. Staff move the phase here.
- A pass earns a qualification with a date; it does not auto-promote phase.
- Runs with Fleet switched off. Does not own cars, shifts, stop lists, clock-in, stock, money lines, or map rooms.

## Admin surfaces and ACL (planned)

| Surface | Path / key |
| --- | --- |
| Workers table | `/admin/onboarding` — columns: person, step, event stack, notes, log. Filters for step, event type, event day, and to-dos. New rows arrive live |
| Person row | The same table, expanded. Open steps and their forms, the event stack, timestamped notes, sent-mail log. Checking out an event can unlock the next step |
| Step builder | Steps, what they unlock, bookable flag, attached form, who may edit, which Email Manager starter belongs to this step |
| Training | Types, sittings, practical checklist, trainer calendar. Quiz definition opens in Forms |
| Invite | Create the user; send set-password and application mail via Email Manager |
| ACL area | `onboarding` → `admin.onboarding` (view / edit / manage). Separate trainer and training-manager grants from Fleet managers. App admin bypasses. |

Staff menus stay additive (`sf-staff-bypass`). Do not refuse `isAppAdmin` on ownership-gated tools.

## Slice order (when unparked)

One slice per chat. Stop when that slice’s checks pass. **Do not start schema or admin UI in the plan-only chat.**

1. **Scaffold** — `src/modules/onboarding` manifest (`layer: advanced`), hard `requires`: Forms, Media, Email Manager, Profiles; `optionalRequires`: Fleet; empty public door; README Owns/Consumes; registry generate. No commerce tables. No Core fact-map port.
2. **Status builder + identity facts** — statuses with a bookable flag and an optional Forms definition id; driver code, phone, Fleet station id, home-run, trainer, Clearquote. Person-fact reads on the public door. Station list comes from Fleet when Fleet is on.
3. **Procedure + notes + invite** — three event cards, notes, follow-up, calls, mail log, invite + Email Manager starters.
4. **Training** — checklist and PDF (pack-local until Documents exists), trainer calendar, then a Forms quiz attempt; qualification on pass without a status move.
5. **Valid-until** — licence, health booklet, contract; missing vs expired.
6. **Documents bridge** — when `product:documents` exists, person-file render goes through that door.

## Explicit non-goals

| Out | Why |
| --- | --- |
| Separate `product:training` | Training is part of this pack |
| Cars, shifts, routes, clock-in | `product:fleet` |
| Second account / name / email store | Core user |
| Field builder or SMTP | Forms / Email Manager |
| File bytes store | Media |
| TacMap rooms | Core MapProvider is for Fleet routes; TacMap is not for recruiting |
| Stock or money ledger | Later warehouse / ledger |
| Starting ahead of Social → Marketplace | Live map |

## Related

- Build spec (parked): [onboarding-build-spec](./onboarding-build-spec.md)
- Family index: [primeone-pack-plans](./primeone-pack-plans.md)
- Fleet (fact-map consumer): [fleet-pack-plan](./fleet-pack-plan.md)
- Documents (shared renderer): [documents-pack-plan](./documents-pack-plan.md)
- Live map: [architecture-current](./architecture-current.md)
- Layers: [platform-module-layers](./platform-module-layers.md)
