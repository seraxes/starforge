---
kind: reference
last_verified: 2026-11-26
---
# PrimeOne inventory — drivers (`com_primeone_drivers`)

**Coverage:** [primeone-coverage-plan](./primeone-coverage-plan.md). **Ownership:** [onboarding-pack-plan](./onboarding-pack-plan.md), [primeone-pack-plans](./primeone-pack-plans.md).  
**Live source:** PrimeOne repo, component **v0.7.70**. Paths relative to that repo root.  
**Rule:** Training ∈ **onboarding**. No second training pack. Mark ops-unclear rows `unknown` (ops), not `yes`.

## Related extensions

| Live surface | In use? | Starforge owner | First build? | Proof | Spec link |
| --- | --- | --- | --- | --- | --- |
| Site + admin `com_primeone_drivers` | yes | onboarding | yes | `components/com_primeone_drivers/`, `administrator/components/com_primeone_drivers/` | [onboarding-pack-plan](./onboarding-pack-plan.md) |
| `media/com_primeone_drivers` CSS/JS | yes | onboarding | yes | `media/com_primeone_drivers/` | — |
| `mod_primeone_drivers` → site drivers list | yes | onboarding | yes | `modules/mod_primeone_drivers/` | — |
| `mod_primeone_drivers_home` → driver tiles | yes | page | yes | `modules/mod_primeone_drivers_home/` | — |
| `mod_primeone_onboarding` document checklist % | yes | onboarding | yes | `modules/mod_primeone_onboarding/` | — |
| `plg_content_primeone_ridealong` shortcode confirm | unknown (ops) | onboarding | yes | `plugins/plg_content_primeone_ridealong/` | — |
| `plg_system_primeone_usercontext` drivers params | unknown (ops) | core | no | `plugins/plg_system_primeone_usercontext/` | — |
| `plg_system_primeone_rsformedit` RSForm prefill | yes | forms | yes | `plugins/plg_system_primeone_rsformedit/` | — |
| Package zip artifacts | no | drop | no | `packages/com_primeone_drivers/*.zip` | — |

## Screens (admin + site)

| Live surface | In use? | Starforge owner | First build? | Proof | Spec link |
| --- | --- | --- | --- | --- | --- |
| Admin dashboard (config summary) | yes | onboarding | yes | `administrator/…/tmpl/dashboard/default.php` | — |
| Admin Driver States (usergroup children) | yes | onboarding | yes | `administrator/…/tmpl/states/`, `StatesController.php` | — |
| Admin tiles CRUD | yes | page | yes | `administrator/…/tmpl/tiles/`, `#__primeone_driver_tiles` | — |
| Admin configuration | yes | onboarding | yes | `forms/configuration.xml`, `config.xml` | — |
| Site staff drivers list | yes | onboarding | yes | `components/…/tmpl/drivers/default.php` | — |
| Site driver-home tile dashboard | yes | page | yes | `components/…/tmpl/dashboard/default.php` | — |
| Site Trainer Manager calendar | yes | onboarding | yes | `tmpl/trainermanager/default.php`, `accept.php` | — |
| Site training report form | yes | onboarding | yes | `tmpl/training/default.php` | — |
| Site training reports list | yes | onboarding | yes | `tmpl/trainingreports/default.php` | — |

## Actions / AJAX

| Live surface | In use? | Starforge owner | First build? | Proof | Spec link |
| --- | --- | --- | --- | --- | --- |
| Notes save/delete | yes | onboarding | yes | `DriversController` `saveNote` / `deleteNote` | — |
| Change Driver State (status) | yes | onboarding | yes | `changeStatus` | — |
| Follow-up / call / status reminder mark | yes | onboarding | yes | `saveFollowUp`, `saveCall`, `saveStatusReminder` | — |
| Status reminder + event emails | yes | email-manager | yes | `sendStatusReminderEmail`, `sendEventEmail`; activity log | — |
| Driver activity history | yes | onboarding | yes | `getDriverActivity` | — |
| Profile details + file replace/view | yes | forms / media / documents | yes | `getDriverDetails`, `saveDriverDetails`, `replaceDriverFile`, `viewFile` | — |
| Procedure event lifecycle (ride-along / trial / test) | yes | onboarding | yes | `saveRideAlongConfirm`, `unlockEvent`, `setEventRequestedDates`, `saveEventOutcome`, … | — |
| Applicant attending confirm | yes | onboarding | yes | `confirmRideAlongAttendance` | — |
| Save driver code / trainer / home-run facts | yes | onboarding | yes | `saveDriverCode`, `saveTrainer`, `saveHomeRun` (+ Fleet Active Drivers write-back) | — |
| Create applicant + set password | yes | onboarding / core / email-manager | yes | `createApplicant`, `setPassword` | — |
| Instructors CRUD + user search | yes | onboarding | yes | `listInstructors`, `saveInstructor`, … | — |
| Trialday / testday rosters | yes | onboarding | yes | `listTrialdays`, `listTestdays` | — |
| Export exam roster text | yes | onboarding | yes | `exportExam` | — |
| Trainer Manager slots | yes | onboarding | yes | `TrainermanagerController` `saveSlot` / `cancelSlot` / `decideSlot` / `accept` | — |
| Training report save + PDF | yes | onboarding | yes | `TrainingController` `save`, `pdf`; `TrainingReportPdf.php` | — |
| Poll drivers list | yes | onboarding | yes | `pollDrivers` | — |

## Phases / workflow

| Live surface | In use? | Starforge owner | First build? | Proof | Spec link |
| --- | --- | --- | --- | --- | --- |
| Phase `recruiting` | yes | onboarding | yes | `DriversEngine::getPhaseForGroup` | — |
| Phase `active` (bookable) | yes | onboarding | yes | `active_group_id` / title `aktív`/`active` | — |
| Phase `inactive` | yes | onboarding | yes | `inactive_group_id` / title match | — |
| Phase `closed` (visszautasítva = applicant declined) | yes | onboarding | yes | titles `visszautasítva` / `closed` / `denied` / … | — |
| Phase `banned` (kitiltva = company refused) | yes | onboarding | yes | `kitiltva_group_id` / titles `kitiltva`/`banned` | — |
| Live group titles / IDs in ops | unknown (ops) | onboarding | yes | Config params; needs live DB | — |
| Event types `ridealong` \| `testday` \| `trialday` | yes | onboarding | yes | `supportedEventTypes()` / `#__primeone_driver_events.event_type` | — |
| Outcomes `email_sent`, `completed`, `no_show`, `passed`, `failed` | yes | onboarding | yes | EventService / DriversEngine | — |
| Meeting mode `onsite` \| `online` | yes | onboarding | yes | `#__primeone_driver_events.meeting_mode` | — |
| Applicant response `attending` | yes | onboarding | yes | `applicant_response` | — |
| Staff list filters `all`/`requested`/`norequest`/`confirmed`/`soon` | yes | onboarding | yes | `tmpl/drivers/default.php` | — |

## Training (→ onboarding only)

| Live surface | In use? | Starforge owner | First build? | Proof | Spec link |
| --- | --- | --- | --- | --- | --- |
| Practical training report + 14-section checklist | yes | onboarding | yes | `#__primeone_driver_training`, `TrainingChecklist.php`, `TrainingService.php` | — |
| Training status `open`\|`closed`; passed `yes`\|`no`\|`partial`\|`''` | yes | onboarding | yes | install SQL + TrainingService | — |
| Training save log | yes | onboarding | yes | `#__primeone_driver_training_log` | — |
| Training PDF render (pack-local until Documents) | yes | onboarding | yes | `TrainingReportPdf.php` | [documents-pack-plan](./documents-pack-plan.md) |
| Trainer calendar (≤3 slots/day) | yes | onboarding | yes | `#__primeone_trainer_assignments`, `TrainerManagerService.php` | — |
| Slot status `pending`\|`accepted`\|`cancelled`; kind `ridealong`\|`induction` | yes | onboarding | yes | TrainerManagerService | — |
| Instructors + trainer people | yes | onboarding | yes | `#__primeone_instructors`, `#__primeone_trainer_people` | — |
| `is_trainer` flag + trainer ACL / group | yes | onboarding | yes | `#__primeone_driver_profile.is_trainer`; `access.xml` `trainer` / `trainer.manage` | — |
| Built-in online quiz engine | no | drop | no | Absent — testday uses form + `exam_url` | — |
| Testday / external exam URL | yes | onboarding / forms | yes | `#__primeone_driver_events.exam_url`; form id default 11 | — |
| Separate qualification entity table | no | onboarding | later | Closest: pass on report + trainer flag; pack plan may add dated qualification | [onboarding-pack-plan](./onboarding-pack-plan.md) |

## Document slots / files

| Live surface | In use? | Starforge owner | First build? | Proof | Spec link |
| --- | --- | --- | --- | --- | --- |
| Slot map: station, photo, cv, ev, taxnumber, license, id, residence, health, contract | yes | onboarding / documents | yes | `DriversEngine::documentFieldMapFromParams` | — |
| Slot values from RSForm submissions | yes | forms / media | yes | `#__rsform_submission_values`; replace via `replaceDriverFile` | — |
| Member onboarding checklist progress module | yes | onboarding | yes | `modules/mod_primeone_onboarding/` | — |
| Valid-until / expiry columns on slots | no | onboarding | later | Not in drivers schema; presence-only today | [onboarding-pack-plan](./onboarding-pack-plan.md) |

## Invites / forms

| Live surface | In use? | Starforge owner | First build? | Proof | Spec link |
| --- | --- | --- | --- | --- | --- |
| Application RSForm (default form id 4) | yes | forms | yes | `DriversParams` / `config.xml` `application_form_id` | — |
| Onboarding RSForm (default form id 5) | yes | forms | yes | `onboarding_form_id` | — |
| Ride-along / testday / trialday RSForms (defaults 10/11/12) | yes | forms | yes | `config.xml` | — |
| Live FormIds / FieldNames in production | unknown (ops) | forms | yes | Defaults may be stale; needs ops DB | — |
| Joomla Fields notes / follow-up / events envelopes | yes | onboarding | yes | `#__fields_values` + mirror tables | — |
| Create applicant → Registered + recruiting status + invite mail | yes | onboarding / core / email-manager | yes | `createApplicantAjax` | — |

## Mails

| Live surface | In use? | Starforge owner | First build? | Proof | Spec link |
| --- | --- | --- | --- | --- | --- |
| Account invite subject/body | yes | email-manager | yes | params `account_invite_*`; placeholders `{name}` `{email}` `{reset}` `{form}` | — |
| Status reminder (recruiting only) | yes | email-manager | yes | `status_reminder_*` + `onboarding_reminder_link` | — |
| Ride-along / trialday / testday confirm mails | yes | email-manager | yes | `ridealong_email_*`, `trialday_email_*`, `testday_email_*` | — |
| Activity log of sends | yes | onboarding | yes | `#__primeone_driver_activity` | — |
| Joomla `com_mails` templates | no | drop | no | Component uses `Factory::getMailer()` + params | — |

## Grants

| Live surface | In use? | Starforge owner | First build? | Proof | Spec link |
| --- | --- | --- | --- | --- | --- |
| `drivers.manage` | yes | onboarding | yes | `access.xml` | — |
| `drivers.status` | yes | onboarding | yes | `access.xml` | — |
| `drivers.profile` | yes | onboarding | yes | `access.xml` | — |
| `trainer` / `trainer.manage` | yes | onboarding | yes | `access.xml` | — |
| Driver States via usergroup membership | yes | core / onboarding | yes | `#__user_usergroup_map` under `parent_group_id` | — |
| Which live groups hold which ACL | unknown (ops) | core | yes | Site ACL UI / DB | — |

## Tables / fields

| Live surface | In use? | Starforge owner | First build? | Proof | Spec link |
| --- | --- | --- | --- | --- | --- |
| `#__primeone_instructors` | yes | onboarding | yes | `sql/install.mysql.utf8.sql` | — |
| `#__primeone_driver_activity` | yes | onboarding | yes | install SQL | — |
| `#__primeone_driver_tiles` | yes | page | yes | install SQL | — |
| `#__primeone_trainer_people` / `_assignments` | yes | onboarding | yes | install SQL | — |
| `#__primeone_driver_codes` (`driver_code` varchar 6) | yes | onboarding | yes | install SQL | — |
| `#__primeone_driver_profile` (`allow_home_run`, `home_run_free_km`, `is_trainer`, `clearquote`) | yes | onboarding | yes | install SQL; Fleet reads via identity API | — |
| `#__primeone_driver_training` (+ `_log`) | yes | onboarding | yes | install SQL | — |
| `#__primeone_driver_notes` / `_followup` / `_followup_tags` | yes | onboarding | yes | install SQL | — |
| `#__primeone_driver_events` | yes | onboarding | yes | install SQL | — |
| `#__primeone_driver_calls` | yes | onboarding | yes | install SQL | — |
| `#__primeone_driver_field_import` | unknown (ops) | drop | no | Migration marker | — |
| External RSForm + Fields + usergroups | yes | forms / core | yes | Joomla core / RSForm tables | — |

## Home / coming up / analytics (drivers side)

| Live surface | In use? | Starforge owner | First build? | Proof | Spec link |
| --- | --- | --- | --- | --- | --- |
| Driver home tiles by status | yes | page | yes | Site dashboard + tiles table | [primeone-pack-plans](./primeone-pack-plans.md) |
| Staff “soon” / confirmed filters (procedure coming up) | yes | onboarding | yes | Drivers list filters + `due_notice` | — |
| Ops analytics / KPI charts in this component | no | drop | no | Not found | — |

## Row count

**88** inventory rows in this file (including related-extensions block).
