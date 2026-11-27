# product:onboarding

Layer: advanced

Class: advanced — domain product. Hard `requires`: Forms, Media, Email Manager, Profiles. `optionalRequires`: Documents; Fleet once `product:fleet` is a manifest id. `defaultEnabled: false`.

Status: slices 1–12 in tree (Documents bridge + driver-home particle). Fleet stays parked. Design: [onboarding-pack-plan](../../../docs/project-context/docs/onboarding-pack-plan.md). Coding slices: [onboarding-build-spec](../../../docs/project-context/docs/onboarding-build-spec.md).

## Owns

- Fail-closed door (`runOnboardingDoor`)
- Status builder (`sf_onboarding_statuses`) — name, key, phase (`recruiting` / `declined` / `inactive` / `active` / `banned`), display label, action chip, next-step message, optional Pages page id (plain text; Pages owns the article), bookable (synced from active phase), optional Forms definition id, reminder Email Manager template id (recruiting only). Adding a named status is enough for later pickers to list it. No Joomla group ids.
- Dashboard tiles (`sf_onboarding_dashboard_tiles`) — title, icon, URL, order, published, status ids (empty = every status), staff-only. Feed the `driver-home` particle. Staff: `viewer.isAppAdmin` or `viewerMayAccessAdminResource(viewer, 'admin.onboarding', 'edit')`.
- Identity facts on the Core user id (`sf_onboarding_identity_facts`) — current status, driver code (unique, ≤6), phone, station id, home-run allow / free km, trainer, Clearquote
- Procedure events (`sf_onboarding_events`) — `kind` is an event-type catalog key (plain text, no FK); location, address, date, time, courier, meeting mode, exam URL, applicant response, outcome (+ actor/time), also-trial, requested dates / submission id, due notice. Create and update stay. Delete removes one card and does not delete the type. Outcome is the event’s own result and never advances the main status.
- Notes (`sf_onboarding_notes`), follow-ups (`sf_onboarding_follow_ups`), calls (`sf_onboarding_calls`), mail log (`sf_onboarding_mail_logs`)
- Staff tag catalog (`sf_onboarding_tags`) — label, color, to-do, fade. Empty label refused. Seeds Waiting (blue), On hold (orange), Action required (red, to-do), No response (yellow) are examples staff can edit or add to — not a fixed set. A tag marks a person; it does not move status. Follow-up stores catalog tag ids only (no second free-text tag list). Unknown tag id refused.
- Invite — create Core user, place in seeded recruiting, emit set-password + application mail via `emitEmailTrigger` (never `getMailer()`), record `account_invite` mail log
- Email Manager starters for account invite, application, status reminder, and event confirms
- Email bindings (slice 8) — Onboarding stores Email Manager template ids only (subject/body stay in Email Manager). Reminder id on a recruiting status; invite id in module settings (`sf_module_settings`); one template id per event type on the catalog. List/read/seed through `@/modules/email-manager/api.server` only. Empty clears; unknown id refused; reminder on a non-recruiting status refused. Seeding a missing starter creates the Email Manager template and stores that id on ride-along, test day, and trial day when the catalog row is empty.
- Email editor popup (slice 9) — Edit on a bound template opens `/admin/email/templates/[id]?embed=1` in a dialog. Email Manager owns the embed flag and save (`updateEmailTemplateAction`). Empty template id is refused and does not open the dialog. Closing leaves the picker on the same id. Onboarding does not copy the template form and never calls `getMailer()`.
- Forms editor popup — Edit on a status with a stored Forms definition id opens `/admin/forms/[formId]?embed=1` in a large dialog. Forms owns the embed flag and save (`saveFormDefinitionAction`). Empty form id is refused and does not open the dialog. Create (when the status has no form) builds a definition through `@/modules/forms/api` (`createFormDefinition`), stores the new id on the status, and opens the same dialog. Closing leaves the picker on that id. Onboarding does not copy the Forms canvas or build a second field editor.
- Event-type catalog (`sf_onboarding_event_types`) — key, label, enabled, Email Manager template id, Forms definition id, date field names, active status ids, completed status ids. Seeds `ridealong`, `testday`, `trialday`, and `trainingday` start enabled and are not the only types. Empty label is refused. Duplicate key is refused. Deactivate sets enabled false: the type stays on existing person cards and is hidden from the new-event kind list. Delete removes a type only when no person card uses that key; if a card exists, delete is refused and the type stays. Staff: `viewer.isAppAdmin` or `viewerMayAccessAdminResource(viewer, 'admin.onboarding', 'edit')`. Moving a person onto a completed status for a type sets that person’s open event of that type to outcome `passed` (never `failed` or `no_show`). Does not change the person’s status from the outcome.
- Depots (`sf_onboarding_depots`) — short name + address while Fleet is absent. Empty name refused. Fleet off → this list is the depot / station catalog for pickers. No Fleet import and no `optionalRequires product:fleet` until that pack exists.
- Training reports (`sf_onboarding_training_reports`) — trainee / instructor user ids, date, depot key/label, training day, plate, rounds, drove, status `open` \| `closed`, passed `yes` \| `no` \| `partial` \| empty, note, 14-section checklist JSON, PDF `mediaId`
- Training save log (`sf_onboarding_training_save_logs`) — report id, actor, action `save`, time
- Qualifications (`sf_onboarding_qualifications`) — created on checklist or quiz pass with a date; unique per person + source; never changes status
- Quiz attempts (`sf_onboarding_quiz_attempts`) — form definition id, attempt id, passed, result note (questions stay in Forms)
- Trainers (`sf_onboarding_trainers`) — name, phone, linked Core user id
- Trainer slots (`sf_onboarding_trainer_slots`) — instructor, date, slot index 1–3, start time, location code, trainee, kind `ridealong` \| `induction`, status `pending` \| `accepted` \| `cancelled`
- Training PDF — when Documents is on, `renderDocumentTemplate` (subject `onboarding`, subject id = report id, template `training-report`); on success store returned `mediaId` on the report. When Documents is off, pack-local `renderTrainingReportPdf` + Media ingest. Authz-disabled Documents door → leave report `mediaId` unchanged; no pack-local PDF for that attempt. Licence / health / contract stay on document slots.
- Document slots (`sf_onboarding_document_slots`) — kinds `driving_licence` / `health_booklet` / `contract`; `mediaId` for the file; `validUntil` date only. Empty valid-until is missing (not expired). Past date is expired. Presence-only import → empty valid-until. Answers stay in Forms.

Driver-home particle (`driver-home`) is in tree.

## Consumes

- **forms** — one definition id per status; quiz questions, correct answers, and pass mark stay in Forms. This pack stores the attempt id and result only. Event types also store a Forms definition id for requested dates. Status Edit/Create opens the Forms builder with `?embed=1` via `@/modules/forms/api` (`createFormDefinition`). Never import Forms private files.
- **media** — kept files and training PDF bytes as `mediaId`. No onboarding library.
- **email-manager** — starters + `emitEmailTrigger` + `listEmailTemplates` / `findEmailTemplateById` / `seedEmailStarter` via `@/modules/email-manager/api.server`. Edit dialog loads Email Manager’s template editor with `?embed=1`. Never `getMailer()`. Never import Email Manager private files.
- **profiles** — labels and avatar; phone fallback only when the onboarding phone fact is missing. Name and email stay on the Core user.
- **documents** (optional) — training-report template render via `loadModuleDoor('documents-api-server')` → `renderDocumentTemplate` on `@/modules/documents/api.server` (no static advanced→advanced import). Pack off → pack-local PDF. Authz disabled → leave report `mediaId` alone. Does not move licence / health / contract slots.
- **fleet** (optional, not declared yet) — station list only, when that pack exists. This pack stores the station id. While Fleet is absent, the depot list is the catalog.
- **Core ACL** — `admin.onboarding` (view / edit / manage). Staff: `viewer.isAppAdmin` or `viewerMayAccessAdminResource(viewer, 'admin.onboarding', 'edit')`. Staff bypass is additive (`sf-staff-bypass`).
- **Core users** — the person is the Core user. No second account copy. Invite never imports passwords.

## Public door

`@/modules/onboarding/api` and `@/modules/onboarding/api.server`. Door ids: `onboarding-api`, `onboarding-api-server`.

Server exports (pack off → `runOnboardingDoor` returns `disabled` and does not run the work):

- `runOnboardingDoor`
- `listOnboardingStatuses` — includes phase, display label, action chip, next-step message, reminder template id, attached form id; seeds recruiting / active / inactive / closed (declined) / banned
- `getOnboardingIdentityFacts` / `writeOnboardingIdentityFacts` — status change may set open event outcomes to `passed` when the new status is listed as completed for that event type
- `isOnboardingUserBookable(userId, hasVehicleAccess)` — active phase (bookable flag), or vehicle access; neither → deny
- `listOnboardingStations` — Onboarding depot catalog while Fleet is absent (empty when no depots)
- `listOnboardingWorkers` / `getOnboardingPersonCard` / `listOnboardingEventsForUser`
- `inviteOnboardingPersonDoor` — create user + recruiting + mail; off → no user
- `setOnboardingEventOutcomeDoor` — outcome only; status unchanged
- `ensureOnboardingEmailStartersDoor` / `seedOnboardingEmailStartersDoor` — seed also binds empty Onboarding template ids
- `loadOnboardingSettingsDoor` / `saveOnboardingSettingsDoor` — invite template id. Event-type template ids and Forms / date fields / active / completed status ids live on the catalog.
- `getOnboardingLatestTrainingResult` / `listOnboardingTrainingReports` / `listOnboardingQualifications`
- `saveOnboardingTrainingReportDoor` / `recordOnboardingQuizAttemptDoor` — pass creates qualification; status unchanged
- `listOnboardingDocumentSlots` / `saveOnboardingValidUntilDoor` — licence / health / contract dates; empty = missing

No Core fact-map port.

## Admin surfaces

`/admin/onboarding` — people table + invite (Events / Page Settings chrome; selects controlled). Status column shows the display label.  
`/admin/onboarding/people/[userId]` — main status picker, valid-until dates, event cards (create, update, delete one card; new-event kind list is enabled types only), notes, follow-up (catalog tag checkboxes), calls, mail log.  
`/admin/onboarding/statuses` — status builder (phase, display label, action chip, next-step; reminder template picker on recruiting rows; controlled selects; bottom-right Save). Edit on a reminder opens the Email Manager template editor in a dialog (`?embed=1`). Edit on a status form opens the Forms builder in a large dialog (`?embed=1`); Create builds a definition when the status has none.  
`/admin/onboarding/settings` — invite template; event-type catalog (Add, Activate or Deactivate, Delete; template, Forms id, date fields, active / completed statuses; controlled selects; bottom-right Save); depot list; staff tag catalog (label, color, to-do, fade — controlled; bottom-right Save); dashboard tiles (Add / Delete; status multi-select controlled; bottom-right Save); seed starters.  
`/admin/onboarding/training` — reports, trainer calendar, qualifications.  
Nav group `onboarding`. ACL area `onboarding`.

## Frontend

Navigation module views (not admin):

`/onboarding/apply` — applicant application. Name, email, and phone create a Core user in recruiting and send set-password mail. A signed-in person is sent to their home instead.  
`/account/onboarding` — signed-in user home. Current status label, action chip, next-step message, and that status’s dashboard tiles. No step yet → link to apply. Anonymous visitors go to login.

Nav keys: `apply`, `home`. Admin keys stay on `/admin/onboarding`.

## Boot and jobs

None.

## Known gaps

- `optionalRequires: product:fleet` is omitted until Fleet is scaffolded. Unknown optional ids fail `modules:generate`. Depot list is the catalog until then.
- No Core fact-map port.
- Wiring an event outcome to advance the main status is a later option.
- Documents bridge (slice 6) is in tree — training PDF through Documents when on; pack-local while off.
- Driver-home particle is in tree (`driver-home`; requires `product:onboarding`). Pack off or no signed-in person → renders nothing.

## Tests

Registered in `test:unit`:

- `door.test.ts` — on runs `work`; off returns `disabled`
- `status-rules.test.ts` — empty status name refused; phase active is bookable; a new named status is returned by the status list; bookable flag / vehicle access; driver code > 6 refused; Fleet contribution empty while Fleet absent
- `email-binding-rules.test.ts` — recruiting status accepts a known template id; reminder on non-recruiting refused; unknown template id refused
- `email-template-embed.test.ts` — non-empty id builds `/admin/email/templates/[id]?embed=1`; empty id refused (no URL)
- `form-definition-embed.test.ts` — non-empty id builds `/admin/forms/[formId]?embed=1`; empty id refused (no URL)
- `event-type-settings-rules.test.ts` — completed status sets open event outcome to passed; same move does not set failed or no_show; empty depot name refused
- `event-type-catalog-rules.test.ts` — a new type with a label and unique key is accepted; empty label is refused; delete of a type that has a person card is refused; a deactivated type is omitted from the new-event kind list
- `tag-catalog-rules.test.ts` — empty tag label refused; a saved tag does not change the person’s status id; follow-up accepts a catalog tag id and refuses an unknown tag id
- `dashboard-tile-rules.test.ts` — a tile limited to one status is hidden on another status; empty status list shows for every status; unpublished tile is hidden
- `invite.test.ts` — invite creates a Core user and records `account_invite`; invite refused when off (no user)
- `procedure-rules.test.ts` — outcomes per kind; event outcome does not change status id
- `training-rules.test.ts` — checklist pass creates qualification and leaves status unchanged; quiz fail does not create qualification; checklist not 14 sections refused; trainer slot index above 3 refused
- `training-documents-bridge.test.ts` — Documents on returns a mediaId to store; Documents off stores pack-local mediaId; authz disabled leaves mediaId and skips pack-local PDF
- `valid-until-rules.test.ts` — empty valid-until is missing (not expired); past date is expired; future date is not expired
