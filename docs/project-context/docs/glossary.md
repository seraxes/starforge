# Starforge glossary

Vocabulary from `.cursor/rules/sf-architecture.mdc` and section 1 of `ARCHITECTURE_REMEDIATION_PLAN.md`. When this page disagrees with [architecture-current](./architecture-current.md), the live map wins.

## Core

The host that boots every site; it is not a `requires` id.

**Test:** If the site cannot boot without it, it is Core.

## Base module

A shared engine that other packs list in `requires`; a base pack may `require` another base pack, and that does not make it advanced.

**Test:** If other packs `require` it, it is base.

## Advanced module

A domain product that owns a catalog or workflow and whose manifest `requires` names base packs.

**Test:** If it runs a domain and lists base packs in `requires`, it is advanced.

## Hero

One site's brand and vertical rules, calling module public entries and extension points without forking a module.

**Test:** If only one brand needs it, it is Hero.

## Port

A thin Core interface for a shared capability: Mailer, gateway/fiscal adapters, MediaStorage, MapProvider, PageReadsPort, Realtime, RateLimiter, Captcha.

**Test:** A shared capability is a Core port or the base module that already owns it; if no base module owns it, it is a port.

## requires

The hard manifest edge list: choosing a pack installs and enables every base pack it names. Soft edges live in `optionalRequires`. Both count for a legal public-door import ([decision](./decisions/2026-11-15-requires-optional.md)).

**Test:** A pack may import another pack's public door only if `requires` or `optionalRequires` names that id.

## Public door

The only paths another pack may import from a pack: `@/modules/<id>/api`, `@/modules/<id>/api.server`, the documented client barrel `@/modules/<id>`, and pages owned by that pack reached through generated `page.tsx` shims (section 1 calls this a "public entry").

**Test:** If an import reaches another pack's `store`, `schema`, `actions`, or private components, it bypasses the public door.
