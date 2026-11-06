# Media Manager — termék / design spec

**Modul:** `product:media` (kötelező) · **Store:** egy Payload `media` gyűjtemény · **UI:** Core `/app/admin/media`  
**Kapcsolódó:** [media-pipeline-plan](./media-pipeline-plan.md) (sharp / WebP / S3 / tags) · Preferences Media sor

Ez a **könyvtár UX** spec — nem a encode pipeline. Pipeline szabályok, storage port, analysis stub: lásd a pipeline plant. Ez a doksi azt írja le, mit lát és csinál a szerkesztő a könnyű, modern Media Managerben.

**Közös platform-port:** ezt a Media Managert használja majd a **piactér (marketplace)**, **Event Manager**, **Ads Manager**, Form, Layout Styles/Logo, és minden egyéb komplex / Hero modul. Egy könyvtár, egy picker — modulok **nem** építenek saját media UI-t vagy külön store-t.

---

## 1. Célok / Goals

| # | Cél | Success |
| --- | --- | --- |
| G1 | **Szép, könnyű könyvtár** Gantry/Core admin chrome-ban | Library elsőre fájlkezelő-érzetű; nem Payload raw lista |
| G2 | **Kép feltöltés** (galéria + mobil kamera) | Upload → sharp pipeline → grid azonnal |
| G3 | **Kattintás → nagyítás** | Lightbox / popup: nagy preview, meta, gyors műveletek |
| G4 | **Beágyazható kategóriák** (mappa-fa) | Bal oldali fa mint Explorer; nested browse + drag/move később |
| G5 | **Modern lightweight manager elvárások** | Filter, search, tags, delete, picker; **nem** enterprise DAM |
| G6 | **Egy shared Media Manager minden modulnak** | Events / Ads / Marketplace (piactér) / Forms / Styles / Hero csak `mediaId` + shared picker; **nincs** forked per-module library |

**Elvek (röviden):**

- **Single shared Media Manager** — egy Core (majd `product:media`) library UI + egy Payload `media` store. Modules (Events, Ads, Marketplace/piactér, Forms, Layout Styles, Social, Stream, Shop, …) **fogyasztják** `mediaId` / `MediaPicker` útján. **Nem** építenek saját upload/browse UI-t és **nem** fork-olnak második media DB-t.
- **Hero / ASN** — ugyanazt a Core Media Managert használja; Hero domain/téma a tetején él, media library **nem** másolódik ASN-be.
- **Consumers pick/bind, don’t rebuild** — modul admin = picker (+ opcionális category/tag filter preset); feltöltés / fa / lightbox a shared managerben marad. Lightweight scope megmarad.
- **Egy store · IDs primary** — Payload Media only; kötések `mediaId` (URL advanced/fallback).
- **Taxonomy shared** — Tags (és később Categories) tartalom + Media közös; Media nem saját siló.
- **Admin chrome** — blue-dominated high-tech minimalist (`/app/admin`); teljes szélesség; Page Settings-szerű paneles nyelv (nem Layout canvas).
- **Moduláris** — `product:media` required; UI ma Core-ban, M5-ben `src/modules/media`.

---

## 2. UX / Felület

### 2.1 Library grid (könyvtár rács)

**Route:** `/app/admin/media` (nav: **Media → Library**)

| Elem | Viselkedés |
| --- | --- |
| Layout | Bal: mappa-fa · Jobb: toolbar + filter sáv + thumbnail rács/lista · Teljes szélesség |
| **Views** | **Mosaic** (grid) + **List** (egymás alá / stacked rows); toolbar toggle; URL `?view=mosaic\|list` (default mosaic) |
| **Thumbs** | **Fix 1:1 (square)** — `aspect-ratio: 1 / 1` + `object-fit: cover` (mosaic + list small thumb + picker tiles) |
| Card | Square thumb (Payload `thumbnail` WebP), alt/filename, category/purpose/tag chip-ek |
| Empty | „Nincs média” + feltöltés CTA; üres mappa külön üzenet |
| Multi-select (slice) | Checkbox / shift-range később; v1: single + lightbox |
| Density | Komfortos Gantry gombméret; mosaic = square grid; list = stacked rows with square thumb |
| Status strip | Storage label (local / S3 ready?), total count, link → CMS Media (raw) |

**Filter / search:** category (nested), purpose (`logo` \| `photo` \| `other`), tag, szöveges `q` (alt/filename), view. **Clear filters** + URL query sync.

### 2.2 Folder tree / kategória-fa

**User request (HU):** *„Kategóriák, amik egymásba ágyazhatók, mint egy fájlkezelő mappa-fa.”*

| Viselkedés | Spec |
| --- | --- |
| Fa | Bal sidebar: **All media** + hierarchikus mappák (expand/collapse) |
| Browse | Kattintás = szűrés arra a mappára (+ opcionálisan children include toggle később) |
| CRUD (slice) | Új mappa, átnevezés, törlés (üres / „move contents” confirm) |
| Nest | Parent → child; max depth praktikus limit (pl. 4–6); cycle tilos |
| Upload target | Aktív mappa = default upload folder; felülírható az upload formon |
| Flat fallback | ~~Amíg nested Categories nincs: `MEDIA_FOLDERS` select + sidebar lista~~ — **Phase 2 shipped:** nested Categories tree; legacy `folder` kept for Form privacy / migrate |

**Ne keverjük:** `purpose` (pipeline: logo/photo) ≠ mappa. `folder=forms` + `private` = Form mellékletek — library-ből alapból rejtve / külön.

### 2.3 Lightbox / popup (nagyítás)

**User request (HU):** *„Képre kattintva popupban nagyobb nézet.”*

| Elem | Spec |
| --- | --- |
| Open | Card / thumb click → modal (centered vagy draggable floating; Close, nem Cancel) |
| Image | Nagyobb size (`large` WebP ha van; logo/PNG → original) |
| Meta | alt, filename, folder/category path, purpose, tags, méret/mime |
| Actions | Edit alt (autosave/patch), change folder/tags/purpose, Copy `mediaId` / URL, Delete (confirm), „Open in CMS” |
| Nav | ← → előző/következő a jelenlegi filter eredményben; Esc zár |
| A11y | focus trap, Esc, aria-label a dialóguson |

v1 elég: preview + meta + delete + close. Edit mezők jöhetnek ugyanezen a popupban.

### 2.4 Upload

| Elem | Spec |
| --- | --- |
| Control | `accept="image/*"` + `capture="environment"` (mobil) |
| Fields | folder/category, purpose, optional tag(s), **alt required** (üres → block vagy filename fallback policy — ma: alt kötelező a collectionön) |
| Feedback | Toast „Uploaded.” + grid refresh; hiba üzenet a form state-ből |
| Pipeline | Mindig `applyMediaPipelineRules` (Core + Payload `beforeChange`) — lásd pipeline plan |
| Multi-file (slice) | Több fájl egyszerre; progress list; v1 lehet single |
| Drag-drop (slice) | Drop zone a grid üres/felső sávjára |

Video mime **out of scope** amíg ffmpeg slice nincs.

### 2.5 Tagging

| Facet | UI | Modell |
| --- | --- | --- |
| **Tags** | Filter facet + chip a cardon + upload optional tag + lightbox multi-tag | Payload `tags` hasMany (shared Pages-szel) — **shipped** |
| **Purpose** | Filter + upload | `logo` \| `photo` \| `other` — **shipped** |
| **Categories** | Fa + assign | Nested taxonomy (lásd §3) — **Phase 2** |
| **ACL** | — | Később group tags OR-match; üres = aki eléri a felületet |

Picker (`MediaPicker`): ugyanazok a facet-ek (folder/category, purpose, tag) + thumb grid; kiválasztás = `mediaId` (+ alt). Lightbox a pickeren opcionális (preview only). **Ez a contract** Events / Ads / Marketplace / Forms / Layout / Hero felé — fogyasztók a pickert ágyazzák be, nem másolják az upload UI-t.

---

## 3. Adatmodell / Data model

### 3.1 Döntés: nested categories vs flat folders

| Ma (shipped) | Cél (lightweight manager) |
| --- | --- |
| `Media.folder` — **flat string select** (`MEDIA_FOLDERS`: general, logos, …, forms) | **Nested Categories** shared taxonomy + Media relation |
| Jó coarse bucket-ekhez | Fájlkezelő-szerű fa a user kérés szerint |

**Ajánlott migrációs út:**

1. **Keep** `folder` a közeli slice-okig (Form `forms`, pipeline/privacy helper-ek).
2. **Add** shared **Categories** collection (vagy újrahasznosított `sf_categories` ha van): `name`, `slug`, `parent` (self-ref), `path`/`breadcrumbs` derived.
3. Media: `categories` hasMany **vagy** single `category` (primary browse) — **javaslat v1:** egy primary `category` (fa browse egyszerű); tags marad multi.
4. Sidebar fa Categories-ből; flat `folder` deprecate → map legacy értékek root category-kre, majd eltávolítás.
5. **Ne** második blob store; **ne** path-string mappa az S3 key helyett taxonomy-ként (storage key ≠ UX folder).

**Tags** maradnak flat multi-select (nem nesteltek). Categories = hierarchy; Tags = labels.

### 3.2 Media document (összefoglaló)

| Mező | Szerep | Állapot |
| --- | --- | --- |
| file + imageSizes | Blob + WebP derivatives | Shipped |
| `alt` | A11y / SEO | Shipped (required) |
| `folder` | Flat browse bucket | Shipped → migrate |
| `purpose` | Pipeline + URL preferencia | Shipped |
| `tags` | Shared taxonomy | Shipped (SF-148) |
| `private` | Form attachments | Shipped |
| `category` / `categories` | Nested browse | **Phase 2** |
| analysis suggestions | OCR/AI write-back | Later |

### 3.3 Bindings / fogyasztók (shared — no per-module libraries)

| Fogyasztó | Hogyan használja a Media Managert |
| --- | --- |
| Layout Styles / Logo particle | `MediaPicker` → `mediaId` (URL advanced only) |
| Forms (option media, later field media) | Picker → `mediaId`; respondent attachments = same store, `private` / reserved folder |
| **Event Manager** | Event / gallery / flyer képek → ugyanaz a library; szűrő category/tag; **nincs** Events-own media UI |
| **Ads Manager** | Kreatív / banner asset → `mediaId` + picker |
| **Marketplace / piactér** | Termék / listing képek → shared library; listázás szűrhet, nem másol store-t |
| Social / Stream / Shop / Galleries (later) | Ugyanígy: filter + bind |
| **Hero / ASN** modules | Ugyanaz a Core Media Manager + Payload store; Hero nem kap külön media stacket |

**Tiltott minta:** modul-specifikus „Media” admin page, második upload pipeline, vagy Hero-forkolt könyvtár. Ha egy modulnak kell „gallery”, az a shared managerből **választ** (és opcionálisan szűr), nem épít újat.

---

## 4. Admin chrome / Navigáció

| Felület | Nav | URL |
| --- | --- | --- |
| **Library** | Media → Library | `/app/admin/media` |
| **Settings** | Media → Settings | `/app/admin/media/settings` |
| Payload raw | CMS → Media | `/admin/collections/media` |
| Tags | CMS → Tags | `/admin/collections/tags` |
| Storage env | Chrome → Environment | S3_* / `STARFORGE_MEDIA_STORAGE` |

**Chrome szabályok:**

- Left sidebar accordion: Media **defaultOpen**; aktív csoport ne csukódjon.
- In-page tabs: Library | Settings (`MediaAdminNav`, Gantry layouts tab classes).
- **Nem** Site Settings topic — pipeline számok a Media → Settings singletonön (`sf_media_settings`).
- Teljes szélesség; kétoszlopos paneles desktop (fa | grid); mobilon fa collapse / drawer.
- Popupok: Close; confirm delete; autosave csak értékváltozásra.

---

## 5. Out of scope (heavy DAM)

Explicit **nem** cél ebben a modulban:

- Enterprise DAM (rights management, expiry workflows, brand portals, multi-tenant asset governance)
- Separate media database / CDN product UI
- In-browser image editor (crop/filters beyond sharp pipeline rules)
- Version history / checkout-checkin
- Bulk AI auto-tag without confirm
- Video studio / timeline (ffmpeg később: upload + transcode only)
- Public end-user “my media” cloud drive
- ImageMagick / második decoder
- Hero/ASN-specific galleries mint Media fork
- **Per-module media managers** (Events Media, Ads Media, Piacter Media, …) — fogyasztók csak picker + `mediaId`

Lightweight = **browse · upload · organize · preview · pick · delete**, shared tags/categories, egy Payload store — **egy manager, sok modul**.

---

## 6. Fázisok / Phased build

### Phase 0 — Van ma (shipped)

| Slice | Mi |
| --- | --- |
| SF-28 | Payload Media + flat folder/purpose, Core library upload, resolve helpers, local `MediaStorage` |
| SF-66 | Logo / Styles / Form picker → `mediaId` |
| SF-117 / 148 | sharp rules + shared apply + `beforeChange`; tags filter; Analysis port stub; `product:media` manifest |
| S3 port | Env-gated adapter (#77); throw ha incomplete |
| Admin | `/app/admin/media` grid + filters; Media → Settings (pipeline numbers); nav accordion Library/Settings |
| Folder browse | Flat folder filter (+ sidebar lista ahol landolt) — **még nem nested fa** |
| Lightbox | **Nincs** — ez a user kérés következő UX szelete |

### Phase 1 — Nice library + lightbox (következő UX slice)

1. Visual polish a gridnek (admin chrome tokens, konzisztens card, empty states).
2. **Click → lightbox popup** (nagy kép, meta, delete, Esc/←/→).
3. Folder sidebar mindig látható (All + flat lista), ha még dropdown-only.
4. MediaPicker lightbox/preview parity (opcionális ugyanabban a PR-ben).
5. Multi-file upload + drag-drop ha belefér; különben azonnal Phase 2 után.

*Implementálható Composer/Auto-val; nincs architecture Opus burn.*

### Phase 2 — Nested categories (mappa-fa) + library view toggle

1. Shared Categories collection (`parent`, slug, name).
2. Media primary `category` (+ migration flat `folder` → root categories).
3. Sidebar **tree** UX: expand, create/rename/delete, browse filter.
4. Upload + picker category target; privacy: `forms` továbbra is külön (flag vagy reserved category).
5. Deprecate `MEDIA_FOLDERS` select UI (legacy `folder` field retained for Form privacy).
6. **Square 1:1 thumbs** + **Mosaic / List** view toggle (`?view=`).

### Phase 3 — Manager hygiene

- Bulk select + move/delete/tag
- Better search (tag AND/OR, purpose chips)
- Analyze button (MediaAnalysisPort) + suggestion confirm
- Site Settings / Media Settings: derivative size sync (ma boot-time `imageSizes` partial gap)
- M5: library UI move → `src/modules/media` (portok Core-ban maradnak)

### Phase 4 — Later (pipeline plan „Explicitly later”)

- Video + ffmpeg rules
- Rich ACL group tags on Media
- HEIC only if devices fail
- Real OCR/vision vendors
- Full gallery/stream modules as **consumers**

---

## 7. Implementer checklist (rövid)

- [x] Library: fa + grid/list + filters URL-sync (Phase 2)
- [x] Upload: image/* + capture, alt, category, purpose, tags → shared pipeline
- [x] Lightbox: open on click, large preview, meta, delete, keyboard (Phase 1)
- [x] Categories nested; tags flat shared; one Payload store (Phase 2)
- [x] Square 1:1 thumbs + Mosaic/List toggle (Phase 2)
- [x] Admin nav: Media → Library / Settings; CMS raw secondary
- [x] No second media DB; no heavy DAM; no ImageMagick
- [x] Picker consumers keep `mediaId` primary
- [ ] Events / Ads / Marketplace / Forms / Styles / Hero reuse this manager only — no forked upload UIs

**User wording captured:** szép Media Manager · kép feltöltés · kattintás → nagyobb popup · beágyazható kategóriák (fájlkezelő fa) · modern lightweight elvárások · **egy shared library** a piactér / Event / Ads / többi komplex modulnak — grounded a meglévő Payload + sharp + tags stackre.
