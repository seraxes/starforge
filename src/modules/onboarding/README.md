# product:onboarding

Layer: advanced

Class: advanced — domain product. Hard `requires`: Forms, Media, Email Manager, Profiles. `optionalRequires`: Fleet once `product:fleet` is a manifest id. `defaultEnabled: false`.

Status: slice 2 (status builder + identity facts) in tree. Procedure cards, notes, invite, training, and the workers table are later slices. Design: [onboarding-pack-plan](../../../docs/project-context/docs/onboarding-pack-plan.md). Coding slices: [onboarding-build-spec](../../../docs/project-context/docs/onboarding-build-spec.md).

## Owns

- Fail-closed door (`runOnboardingDoor`)
- Status builder (`sf_onboarding_statuses`) — name, key, bookable flag, optional Forms definition id
- Identity facts on the Core user id (`sf_onboarding_identity_facts`) — current status, driver code (unique, ≤6), phone, station id, home-run allow / free km, trainer, Clearquote

Events, notes, follow-up, calls, mail log, invite, training, and valid-until are later slices.

## Consumes

- **forms** — one definition id per status. Answers stay in Forms.
- **media** — kept files as `mediaId`. No onboarding library.
- **email-manager** — one starter per step via `emitEmailTrigger`. Never `getMailer()`.
- **profiles** — labels and avatar; phone fallback only when the onboarding phone fact is missing. Name and email stay on the Core user.
- **fleet** (optional, not declared yet) — station list only, when that pack exists. This pack stores the station id. While Fleet is absent, the station list is empty.
- **Core ACL** — `admin.onboarding` (view / edit / manage). Staff: `viewer.isAppAdmin` or `viewerMayAccessAdminResource(viewer, 'admin.onboarding', 'edit')`. Staff bypass is additive (`sf-staff-bypass`).
- **Core users** — the person is the Core user. No second account copy.

## Public door

`@/modules/onboarding/api` and `@/modules/onboarding/api.server`. Door ids: `onboarding-api`, `onboarding-api-server`.

Server exports (pack off → `runOnboardingDoor` returns `disabled` and does not run the work):

- `runOnboardingDoor`
- `listOnboardingStatuses` — includes attached form id; seeds recruiting / active / inactive / closed / banned
- `getOnboardingIdentityFacts` / `writeOnboardingIdentityFacts`
- `isOnboardingUserBookable(userId, hasVehicleAccess)` — status flag on, or vehicle access; neither → deny
- `listOnboardingStations` — empty while Fleet is absent

No Core fact-map port.

## Admin surfaces

`/admin/onboarding` — status list and edit (Events / Page Settings chrome, bottom-right Save; selects controlled). Nav group `onboarding`. ACL area `onboarding`.

## Boot and jobs

None.

## Known gaps

- No events, notes, invite, mail starters, or workers table (slice 3).
- `optionalRequires: product:fleet` is omitted until Fleet is scaffolded. Unknown optional ids fail `modules:generate`. Station list stays empty until then.
- Training PDF stays in this pack until Documents exists (slice 6).
- No Core fact-map port.

## Tests

Registered in `test:unit`:

- `door.test.ts` — on runs `work`; off returns `disabled`
- `status-rules.test.ts` — bookable flag / vehicle access; empty status name refused; driver code > 6 refused; station list empty while Fleet absent
