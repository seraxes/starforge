# Modular core reuse

## When
Building any Core CMS feature that collects or structures user input, content blocks, or admin UI.

## Rule
Ship capabilities as toggleable modules. Prefer one shared engine (e.g. Form) reused by contact, survey, events, voting, tickets/reports — typed presets and workflow layers on top, not parallel builders. Same for media: one Payload media library; social stream, event gallery, paid organizer pages only filter/tag/ACL the same assets — no parallel media stores. New work plugs in; Site Settings can turn it off without ripping the platform.

## Stops when
A true one-off integration cannot share schema/UX without fighting the engine — then document the exception; do not invent a second general form stack.

## Added
2026-11-01
