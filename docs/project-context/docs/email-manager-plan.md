# Email Manager (Modules phase — ahead of Events/Social)

Shared automatic/conditional email pack. **Build after Core freeze** (Profiles thin optional); **before** Events / Maps / Social / Marketplace. Complements shipped [email-mailer-plan](./email-mailer-plan.md) (transport only). Wireframe order: [asn-modules-wireframe](./asn-modules-wireframe.md).

## Why early

Heavy modules all need confirms, digests, and notify rules. One manager + Mailer port beats per-module SMTP and scattered templates.

## Scope (v1 sketch)

| Piece | Intent |
| --- | --- |
| **Transport** | Existing Core **Mailer** + Site Chrome email policy / env secrets — **not** a second SMTP stack |
| **Admin** | Single Email Manager UI; list/filter/categorize rules **by module** (Forms, Auth, Events, …) |
| **Rules** | Automatic + conditional sends (enable, trigger, audience, template) |
| **Triggers** | Modules emit named events (`form.submitted`, `auth.reset`, later `events.registered`, …); manager binds rules |
| **Conditions** | Simple predicates on trigger payload / site context (show/hide send — not a second Form builder) |
| **Templates** | Subject + text/html bodies with merge fields; shared library, module-tagged |
| **Migration** | Fold current Forms notify (and auth mail helpers as ready) onto rules calling `Mailer.send` |

## Out of scope (v1)

- Per-module SMTP / From secrets in module settings  
- Full HTML email designer / marketing automation / campaigns  
- Mandatory queues/retries (optional later; sync soft-fail like today’s Mailer is fine)  
- Replacing in-app **Notifications** (bell stays separate; digests may call Email Manager)

## Contracts to lock

1. Trigger registry: `moduleId` + `eventKey` + typed payload.  
2. Rule → template → `Mailer.send` path; soft-fail never blocks the originating action.  
3. Module toggle: Email Manager off → rules skip; Chrome email off → same.

## Success

- One admin can find every automatic email by module filter.  
- Forms (and later Events) send via rules, not hard-coded notify only.  
- No module stores SMTP credentials.

## Related

- [email-mailer-plan](./email-mailer-plan.md)  
- [asn-modules-wireframe](./asn-modules-wireframe.md)  
- [platform-module-layers](./platform-module-layers.md)  
- [form-engine-plan](./form-engine-plan.md)  
