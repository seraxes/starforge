---
kind: reference
last_verified: 2026-11-27
---
# product:onboarding — build spec

**Status:** Slices 1–5 and 7–11 are in tree. Next chat is slice 12 (driver-home particle) only. Slice 6 waits on Documents slice 3. `defaultEnabled: false`. Fleet and Documents stay parked. Live map: [architecture-current](./architecture-current.md).  
**Pack plan:** [onboarding-pack-plan](./onboarding-pack-plan.md). **Family order:** [primeone-pack-plans](./primeone-pack-plans.md) waves **1, 4, 5, 6**.  
**Inventory:** [primeone-inventory-drivers](./primeone-inventory-drivers.md). **Coverage:** [primeone-coverage-plan](./primeone-coverage-plan.md).

## Goal

Public application (email, phone, photo, plus any extra fields the company adds) creates the Core user, signs them in, and opens the next step with that data already saved. The driver home is an Onboarding particle. It changes with the main step: instruction, progress, the required-data icons, and the action tiles. The user menu shows that step and its colour. A Page may sit above the particle for a long explanation. After sign-up, PrimeOne’s next main step is contact made, then the exam and intro-day booking tile. An active driver sees the fleet tool tiles instead. Each step stores its own tile list. The article stays in Pages.

PrimeOne’s seeded main line is sign up, then exam day, then trial day (ride-along with a trainer), then contract, then active. Active is what sends the driver facts to Fleet. The required-data icons stay available beside every step. Each icon is missing, submitted by the applicant, or approved (green). The contract step opens once the required icons are green. Staff configure which steps unlock which other steps. The person has one current main step. Parallel steps stay open together, so the document pack (ID, driving licence, health certificate, sole-trader tax number and registration number) can happen before or after the exam and the training week. When the main step is active, Fleet may use the projected driver facts to attach them to vehicles.

Managers use one table: person, current step, a stack of events, timestamped notes, and the log. A hashtag tag on the person is a staff mark only (waiting, on a break, not answering, to-do). It is not a step and it does not unlock anything. Filters cover step, event type, event day, and those tags. A new applicant shows up on that table through Core RealtimePort.

Event types are configurable and can be tied to a step. Staff stack as many as the flow needs on one person. Intro day, exam day, and training day are seeds, not the only three. Eredmény sets the event result: confirmation email sent, no-show, completed, successfully completed, and unsuccessful on an exam. It does not move the main step. Wiring a result to an action, including advancing the main step, is a later option. Each event type has an Email Manager confirmation starter. The log column records the send.

## Shared rules

- Joomla stays the system of record until this slice’s reconcile passes.
- Never import passwords. First login sets a new password ([migration-users-events](../../ops/migration-users-events.md)).
- No numeric Joomla group ids. Core ACL only. Staff bypass stays additive ([sf-staff-bypass](../../../.cursor/rules/sf-staff-bypass.mdc)).
- Forms own field schemas. Media owns bytes. Email Manager owns send (`emitEmailTrigger`). Do not call `getMailer()`.
- The person is the Core user. Name and email stay on that user.
- Training stays in this pack. Quiz questions, correct answers, and the pass mark are a Forms quiz mode. This pack stores the attempt and the qualification. Testday also keeps a Forms definition plus `exam_url`.
- Fleet must not read these tables. It calls this public door. This pack calls Fleet’s public door for the station list. No new Core port.

## Door

`@/modules/onboarding/api` and `@/modules/onboarding/api.server`. Door ids: `onboarding-api`, `onboarding-api-server`. Slice 2 exports `runOnboardingDoor`, list statuses, identity fact read/write, bookable, and station list (empty while Fleet absent).

Exports that land with later slices: latest training result; settings load/save; email seed helpers.

Hard `requires`: Forms, Media, Email Manager, Profiles. `optionalRequires`: Fleet once `product:fleet` is a manifest id — omitted in slice 1 because unknown optional ids fail `modules:generate`. `layer: advanced`. `defaultEnabled: false`. No Core fact-map port.

## Slices (one chat each)

| # | Slice | Family wave | Done when |
| --- | --- | --- | --- |
| 1 | Scaffold: manifest, empty door, README Owns/Consumes, registry generate. No tables. | 1 | Done. Door on/off tests, lint, `check:atomic` |
| 2 | Status builder + identity facts. Seeded statuses. Person-fact reads on the door. Station id only; catalog from Fleet. | 1 | Done. Bookable when the status flag is on or the user has vehicle access |
| 3 | Procedure cards, notes, follow-up, calls, mail log, invite + Email Manager starters. | 4 | Done. Invite creates a Core user and sends set-password + application mail |
| 4 | Training checklist, pack-local PDF, trainer calendar, Forms quiz attempt, dated qualification on pass. Pass does not move status. | 5 | Done. PDF stays in this pack until Documents exists. Questions stay in Forms |
| 5 | Valid-until on licence, health booklet, contract. Missing is not expired. | 6 | Done. Presence-only live rows import with empty valid-until |
| 6 | Documents bridge: person-file render goes through `product:documents` when that pack exists. | 9 | Do not start before [documents-build-spec](./documents-build-spec.md) slice 3 |
| 7 | Status phase and driver-list copy. Phase, display label, action chip, next-step message. A new status shows up in later pickers. | 7 | Done. Empty name refused. Active phase is bookable. No Joomla group ids |
| 8 | Email binding. Recruiting status, invite, and each event type store an Email Manager template id. | 7 | Done. Recruiting status accepts a template id. A reminder binding on a non-recruiting status is refused |
| 9 | Email editor popup. Onboarding Edit opens the Email Manager template editor with `embed=1`. | 7 | Done. Empty template id is refused. Embed hides the admin shell. Save stays in Email Manager |
| 10 | Event type settings and depots. Depot list while Fleet is off. Per type: Forms id, date field, active statuses, completed statuses. | 7 | Done. A completed status sets the outcome to passed. It does not set failed or no-show |
| 11 | Staff tag catalog. Label, color, to-do, fade. | 7 | Done. Empty label refused. A tag does not change the person’s status |
| 12 | Driver-home particle. Current status message, action chip, and tiles for that status. | 7 | A tile limited to one status is hidden on another status. An empty status list shows for every status |

## Settings wave (slices 7–12)

Driver States in the live admin is this catalog. Adding a status is what makes that status appear on the driver list, in reminder rows, in event active/completed checklists, and in the tile’s “visible for statuses” list. Do not copy Joomla group ids. Phase is `recruiting`, `declined`, `inactive`, `active`, or `banned`. The active phase is bookable.

| Setting | What Onboarding stores | Who owns the body |
| --- | --- | --- |
| Status message | Display label, action chip, next-step text on the status | Onboarding |
| Reminder | Template id on a recruiting status | Email Manager |
| Status form | Forms definition id on the status | Forms |
| New-driver invite | One template id in Onboarding settings | Email Manager |
| Event type | Template id, Forms definition id, date field name, active status ids, completed status ids | Email body in Email Manager. Fields in Forms |
| Depots | Short name and address, used while Fleet is off | Onboarding |
| Tags | Label, color, to-do, fade | Onboarding |
| Dashboard tile | Title, icon, URL, order, published, status ids (empty = every status), staff-only flag | Onboarding particle |

Edit on a template row opens `/admin/email/templates/[id]?embed=1` in a dialog. Email Manager owns that query and the save. Onboarding does not embed a second editor. A filled send on the person card may change that one message. The mail log stores the filled text. It does not overwrite the template.

Edit on a status form opens `/admin/forms/[formId]?embed=1` in a large dialog. Forms owns that query and the save. Empty form id is refused. Create (when the status has no form) builds a definition through the Forms public door, stores the new id on the status, and opens the same dialog. Closing leaves the status picker on that id. Onboarding does not copy the Forms canvas.

Moving a person into a status listed as completed for an event type sets that event’s outcome to `passed`. It does not set `failed` or `no_show`.

The driver home is an Onboarding particle in the site layout. It reads the current status and shows that status’s message, action chip, and tiles. A Page may sit above it. Onboarding stores the page id. Pages stores the article.

## Identity facts (slice 2)

Hang on the Core user id. Names below are the decision-level shape for a later schema slice. They are not SQL.

| Fact | Live source | Rule |
| --- | --- | --- |
| Status | Driver States group, seeded as `recruiting` / `active` / `inactive` / `closed` / `banned` | Staff can add statuses. `closed` = visszautasítva. `banned` = kitiltva. Each status may attach one edit-enabled Forms definition. |
| Bookable | Status flag, or Fleet vehicle access | Seed `active` as bookable. A person with vehicle access is bookable even when the status flag is off. Neither → deny. |
| Driver code | `#__primeone_driver_codes.driver_code` (up to 6) | Unique. Blank when unset. |
| Phone | Onboarding / application form | Profiles phone is the fallback only when this fact is missing. |
| Station id | Live document field `station` | Fleet owns the catalog. This pack stores the id and loads the list from Fleet. Fleet off → no list. |
| Home-run allow / free km | `#__primeone_driver_profile.allow_home_run`, `home_run_free_km` | Writable from Fleet Active Drivers through the fact map. |
| Trainer | `is_trainer` | Writable from Fleet through the fact map. Does not by itself grant trainer ACL. |
| Clearquote | `clearquote` | Writable from Fleet through the fact map. |

## Procedure, notes, invite (slice 3)

| Record | Fields (decision level) |
| --- | --- |
| Event | Hung on the user. Kinds include `ridealong`, `trialday`, `testday`, and a training day. Location, address, date, time, courier name/phone, meeting mode `onsite` \| `online`, `exam_url`, applicant response `attending`, outcome, outcome actor/time, `also_trial`, requested dates, requested submission id, due notice. The result is the event’s own status. Advancing the main step from a result is a later option. |
| Outcomes | `email_sent` on all three. `completed` / `no_show` on ride-along. `passed` / `failed` / `no_show` on trial day and test day. |
| Note | Body, author, time. Legacy Joomla Fields envelopes import into this record. |
| Follow-up | Tags + short note + reminder status + reminder sent time. |
| Call | `call_at`, done, due notice. |
| Mail log | Channel, subject, body, to-email, sent at, sender. Channels: `account_invite`, `status_reminder`, `event_ridealong`, `event_trialday`, `event_testday`. |
| Invite | Create the Core user. Place them in the first recruiting phase. Send set-password and application mail. |

## Training (slice 4)

| Record | Fields (decision level) |
| --- | --- |
| Report | Trainee and instructor user ids (names/codes are display, not a second account). Date, depot key/label, training day, plate, rounds, drove, status `open` \| `closed`, passed `yes` \| `no` \| `partial` \| empty, note, checklist JSON. |
| Checklist | 14 sections. Each item: shown / practiced / independent + note. |
| Save log | Report id, actor, action `save`, time. |
| Qualification | Created on checklist pass or quiz pass, with a date. No live table today — this slice adds it. Does not change status. |
| Quiz | Forms definition in quiz mode (correct answers + pass mark). This pack stores the attempt id and the result. It does not store questions. |
| Trainer person | Name, phone, linked Core user id. |
| Trainer slot | Instructor, date, slot index (max 3), start time, location code, trainee, kind `ridealong` \| `induction`, status `pending` \| `accepted` \| `cancelled`. |
| PDF | Rendered in this pack until Documents slice 3. Bytes go to Media (`mediaId`). |

## Status forms

The product is a workflow graph, not a line of statuses. Staff configure the inputs for each step by attaching a Forms definition, who may edit them (the driver, a manager, or both), and which steps that step unlocks. Managers and admins audit a driver on one screen: the current main step, the parallel steps that are open, each row showing filled, missing, or no form. Edit opens the Forms submission only when the step setting allows that viewer. Onboarding does not build a second editor and does not copy the answers into its own columns.

Application data, contract data, and training answers are those status forms.

| Seeded use | Live RSForm (ids are settings, not hardcoded) | What Onboarding keeps |
| --- | --- | --- |
| Recruiting / application | Application form (default 4) | Current submission id. Project phone, driver code, station id onto person facts |
| Later driver / contract pack | Onboarding form (default 5): photo, cv, ev, tax number, licence, id, residence, health, contract | Current submission id. File fields are Media ids. Valid-until is a date on this form |
| Training answers | Checklist form (14 sections: shown / practiced / independent) | Current submission id and, on pass, a qualification date |
| Quiz | Forms quiz mode on a training definition | Attempt result and qualification date. Questions stay in Forms |

A status with no intake (for example banned) has no form. Procedure dates, the trainer calendar, notes, follow-up, and calls stay Onboarding records. They are not forms.

## Event confirmation

On the event card, the applicant or staff save one or more requested dates. Confirmation is a separate slot: depot (a Fleet station, address filled from it), date, time, trainer name, and trainer phone. Until that slot is saved, confirmation stays empty.

Email on the card opens the confirmation for that event type. Subject and body are the Email Manager starter with the slot filled in (date, time, depot, address, trainer). Staff may edit the filled text, send it, or copy the subject and body. Send goes through Email Manager and is written to the person’s log. A new event type gets its own starter. Onboarding does not keep a second template store.

## Forms and mail (settings, not hardcoded ids)

| Setting | Role | Live default (ops unknown — do not hardcode) |
| --- | --- | --- |
| Application form definition id | Intake | RSForm 4 |
| Onboarding form definition id | Document pack | RSForm 5 |
| Ride-along form definition id | Requested dates | RSForm 10 |
| Testday form definition id | Exam day | RSForm 11 |
| Trialday form definition id | Trial day | RSForm 12 |

Email Manager starters (this pack seeds them; it does not send):

| Starter | Who | Placeholders |
| --- | --- | --- |
| Account invite | New applicant | name, email, reset link, form link |
| Status reminder | Recruiting phase only | name, link, status, email, phone |
| Intro-day confirm | Applicant | name, date, time, depot, address, trainer name, trainer phone |
| Exam-day confirm | Applicant | same as intro day, plus exam URL |
| Training-day confirm | Applicant | same as intro day |
| Any later event type | Applicant | the same slot fields, plus any extra the type defines |

## ACL

| Grant | Live action | SF |
| --- | --- | --- |
| Onboarding staff | `drivers.manage` | `admin.onboarding` edit |
| Change phase | `drivers.status` | `admin.onboarding` edit (phase action) |
| Profile and file replace | `drivers.profile` | `admin.onboarding` edit |
| Fill a training report | `trainer` | trainer grant |
| Trainer calendar | `trainer.manage` | training-manager grant |

Opening the workers list is the grant. Writing checks the action. App admin bypasses. Which live Joomla groups hold these actions is **unknown (ops)** — map them at cutover, do not copy group ids.

## Import gate (slice 3 forms)

Import submissions only after “latest submission per person per form, older rows kept” matches a live export. A kept file is a Media id, not an empty upload. `#__primeone_driver_field_import` is a migration marker — do not import it.

## Admin surfaces

| Surface | Path |
| --- | --- |
| Workers list | `/admin/onboarding` |
| Person card | Account link, phone, driver code, station, documents, history |
| Training | Reports, trainer calendar, qualifications |
| Invite | Create user + mail |

## Gaps

| Gap | Disposition |
| --- | --- |
| Quiz question builder inside Onboarding | Drop. Forms owns the quiz mode. Testday also keeps Forms + `exam_url`. |
| Separate qualification table on the live site | Add in slice 4. |
| Valid-until columns on the live site | Done in slice 5 (`sf_onboarding_document_slots`). Import presence-only rows with empty dates. |
| `#__primeone_driver_field_import` | Drop. |
| `plg_system_primeone_usercontext` | Unknown (ops). Do not port until ops confirms a consumer. |
| Package zips | Drop. |
| Driver home tiles | Page config, not this pack’s store. See family wave 7. |
| Ops analytics charts | Drop. Analytics is a page over existing rows (wave 7). |

## Related

- Pack plan: [onboarding-pack-plan](./onboarding-pack-plan.md)
- Fleet consumer: [fleet-build-spec](./fleet-build-spec.md)
- Documents bridge: [documents-build-spec](./documents-build-spec.md)
- Live map: [architecture-current](./architecture-current.md)
