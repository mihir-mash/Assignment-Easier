# InkMatch — Technical Architecture

**Approach:** Web-first, modular and testable. Stage 1 is a real end-to-end document/printing vertical slice, not a fake UI. Future handwriting synthesis and printer integration attach via stable adapters.

## 1. Stack and roles

| Layer | Preferred technology | Responsibility |
| --- | --- | --- |
| Web | React + TypeScript + Vite | Editor, input controls, upload, preview, template and profile management |
| UI | Tailwind CSS | Responsive, accessible component styling |
| Overlay | SVG and/or HTML Canvas | Paper-image background; line, margin and glyph overlays; coordinate tools |
| API | Python 3.11+ / FastAPI + Pydantic | Validation, image analysis, deterministic layout endpoint, PDF generation |
| CV | OpenCV + Pillow + NumPy | Image preprocessing, perspective alignment, best-effort paper-line detection |
| PDF | PyMuPDF or ReportLab (select one and document reason) | Ink-only PDF in physical coordinates |
| Persistence | SQLite + local files initially | Templates, documents, profile metadata; optional assets in controlled directory |
| Later ML | PyTorch with isolated synthesis adapter | Personal glyph rendering and higher-fidelity handwriting |
| Stylus | Browser Pointer Events (Stage 2) | Pen/mouse/touch stroke samples, timestamps, optional pressure |
| Printer | PDF download first; optional Windows bridge later | Print calibration and per-printer settings |
| Tests | Vitest + React Testing Library; pytest; Playwright for key flows | Deterministic functional and integration coverage |

Do not add cloud AI APIs, authentication or heavy external infrastructure without explicit approval. Prefer a local FastAPI backend during initial development. Keep deployment flexibility.

## 2. Modules

### Frontend
- `features/paper/`: upload, preview, perspective/crop, automatic suggestions and manual boundary/line editing.
- `features/editor/`: source text editing, live handwriting preview, layout settings, equation toggle, pagination.
- `features/export/`: ink-only PDF download, print instructions, simple manual offset adjustments.
- `features/profiles/`: Stage 2 guided stylus/notes acquisition and coverage.
- `shared/api/`: typed API client with validation/errors.
- `shared/coordinates/`: physical mm ↔ normalized page ↔ on-screen conversions, used for display only.

### Backend
- `api/`: versioned routes and request validation.
- `paper/`: preprocessing, CV-assisted line detection and storage of confirmed page geometry.
- `math/`: pure, tested parser transforming supported source tokens into render runs (not a full LaTeX engine).
- `layout/`: source text + style metrics + page template → canonical positioned runs and pages.
- `renderers/`: Stage 1 demo font renderer; later personal glyph and synthesis adapters.
- `pdf/`: PDF drawing from **canonical positioned runs**, not rewrapped raw text.
- `storage/`: SQLite repositories and asset paths.
- `calibration/`: Stage 1 manual XY offsets; Stage 4 printer-specific transforms.

## 3. Golden rule: one authoritative layout

### Implemented Stage 1 correction (November 2026)

The authoritative algorithm now lives in `shared/layout.ts` and `shared/equations.ts`. React invokes this pure module synchronously for immediate offline preview. FastAPI invokes the exact same module through a fixed-path Node.js 24+ stdin/JSON adapter for `/api/v1/layout` and PDF export. This supersedes the earlier Python approximation and independent frontend fallback. There is still one parser, one metrics table, and one wrapping/pagination implementation, rather than separately maintained frontend/backend algorithms. No user input is evaluated as code.

`frontend/src/useInkMatch.tsx` owns session state, hydration, image workflow and local persistence; tab controls and SVG painting are separate components. Preview SVG viewBoxes use selected page mm dimensions and paint every positioned glyph without CSS wrapping. Export requests capture source/settings, recompute using the identical engine, and ReportLab draws these runs in points with the same font, per-glyph transforms and source ranges. Font metrics are generated from the redistributed Bitstream Vera italic font by `scripts/prepare_font.py`; explicit warnings identify missing glyphs. Neither PDF drawing nor page layout accepts a paper background image.

Paper APIs are implemented separately: `POST /api/v1/paper/detect`, `/crop`, and `/lines`. OpenCV contour/threshold suggestions never constitute accepted boundaries. The user reviews four normalized original-image corners and a homography crop at the confirmed physical aspect ratio, then explicitly accepts it. Line analysis only examines the corrected sheet. Manual edits invalidate the old accepted crop; original images remain available for reprocessing. Upload contents, decoded dimensions, corner winding/convexity, size and physical dimensions are validated. Four UI steps separate physical paper registration, writing-area configuration, live editing and export. The writing preview provides draggable and keyboard-adjustable mm boundaries and first-baseline controls, editable per-line baseline lists, and exclusion-zone overlays; these values use physical mm and flow through the same canonical layout used for ink-only PDF export.

Drafts and printer profiles persist in browser IndexedDB. The template UI lists, creates, loads and explicitly updates templates through the local SQLite API, and maintains a browser cache/fallback. The crop UI retains original image data and manual corners for recropping. `POST /api/v1/calibration/pdf` produces a physical-size cross and 100 mm reference with the current offsets applied. Existing legacy numeric settings are read without destructive migration. Equation Mode is session-only and starts OFF. No photos or document text go to third-party services. Python dependencies are pinned and hash-locked; frontend resolution is in `package-lock.json`.
Frontend should not independently make its own PDF pagination decisions. Backend creates a deterministic `LayoutDocument` with physical coordinates; frontend paints it on the uploaded paper and PDF exporter consumes the same result. Draft updates can be debounced (e.g., 100–250 ms) with cancellation of stale responses. Responses can be cached using a stable document/template/settings revision hash.

Coordinate spaces:
1. **Image pixels**: original camera scan.
2. **Page millimeters**: physical paper space; origin at top-left, x right, y down.
3. **Viewport CSS pixels**: scaled/translated view of mm coordinates.
4. **PDF points**: 72 points/inch; convert via `pt = mm * 72 / 25.4` and flip Y only if required by the library.

Never save the physical positioning based solely on current browser zoom or CSS pixel values. Apply perspective transform during paper image registration, not as a hidden PDF offset.

## 4. Key data contracts (conceptual TypeScript shapes)

```ts
type Id = string;
type Mm = number;

type PageSize = { widthMm: Mm; heightMm: Mm; orientation: 'portrait' | 'landscape' };
type RectMm = { x: Mm; y: Mm; width: Mm; height: Mm };

type PaperTemplate = {
  id: Id;
  name: string;
  pageSize: PageSize;
  backgroundAssetId: Id;             // preview only, NEVER PDF print layer
  registration: { sourceWidthPx: number; sourceHeightPx: number; pageCornersPx?: [number, number][] };
  writableRegionMm: RectMm;
  excludedRegionsMm: RectMm[];
  baselineYsMm: Mm[];               // explicit positions, or derived from rule below
  rule?: { firstBaselineMm: Mm; stepMm: Mm; count: number };
  firstPageVariantId?: Id;
  continuationVariantId?: Id;
  revision: number;
};

type DocumentSettings = {
  fontSizeMm: Mm;
  letterSpacingMm: Mm;
  wordSpacingMm: Mm;
  slantDeg: number;
  inkColor: string;                 // validated hex color
  paragraphGapLines: number;
  indentationMm: Mm;
  baselineShiftMm: Mm;
  variationStrength: number;        // unused by Stage 1 demo renderer
  equationMode: boolean;
  offsetXmm: Mm;                   // simple Stage 1 manual correction
  offsetYmm: Mm;
  seed: number;                     // stable for repeatable variations
};

type HandwritingProfile = {
  id: Id;
  name: string;
  status: 'demo' | 'glyph' | 'synthesized';
  availableCharacters: string[];
  sampleCountByCharacter?: Record<string, number>;
  styleAssetIds?: Id[];
  rendererVersion: string;
};

type DocumentDraft = {
  id: Id;
  title: string;
  templateId: Id;
  profileId: Id;
  sourceText: string;              // always immutable under math toggle except user edits
  settings: DocumentSettings;
  revision: number;
};

type RenderRun = {
  kind: 'text' | 'math' | 'glyph';
  sourceRange: [number, number];
  text: string;
  xMm: Mm;
  baselineYMm: Mm;
  widthMm: Mm;
  fontSizeMm: Mm;
  inkColor: string;
  // Stage 2+: glyph IDs/stroke paths or positioned glyph array
};

type LayoutPage = {
  pageIndex: number;
  pageSize: PageSize;
  templateId: Id;
  runs: RenderRun[];
  warnings: { code: string; message: string }[];
};

type LayoutDocument = {
  draftId: Id;
  draftRevision: number;
  rendererVersion: string;
  pages: LayoutPage[];
  unsupportedCharacters: string[];
};
```

Final DTOs may be implemented in Pydantic and generated/shared as TS types; maintain exact schema parity, typed IDs, validation and API versioning. Renderer-specific shape/stroke representation can be added without changing the public editor contract.

## 5. API proposal (version 1)

Implemented: `GET /api/v1/health`, `POST /api/v1/layout`, `POST /api/v1/export/pdf`, paper processing routes, local SQLite paper-template routes, calibration PDF, and local handwriting profile/sample CRUD routes. Layout/export accept validated snake_case source/settings DTOs, including physical dimensions, spacing, colour, slant, exclusions and XY offsets. Responses include positioned pages/runs and warnings. The browser and API both execute the same shared engine; live editing does not wait for API responses. Document APIs remain planned.

| Endpoint | Purpose |
| --- | --- |
| `POST /api/v1/paper/analyze` | Receive image and known dimensions; return best-effort detected lines/margins with confidence, no irreversible edits |
| `POST /api/v1/paper/templates` | Save manually verified template, its geometry and background reference |
| `GET /api/v1/paper/templates/{id}` | Load template |
| `PUT /api/v1/paper/templates/{id}` | Save explicitly revised template |
| `POST /api/v1/documents` | Create draft and settings |
| `GET /api/v1/documents/{id}` | Retrieve draft |
| `PUT /api/v1/documents/{id}` | Persist source and settings |
| `POST /api/v1/layout` | Return canonical pages/runs from a draft or supplied document payload |
| `POST /api/v1/export/pdf` | Render *the exact layout revision* to ink-only PDF |
| `GET /api/v1/health` | Health check |
| `GET/POST /api/v1/profiles` | List and create local handwriting profiles |
| `GET/PUT/DELETE /api/v1/profiles/{id}` | Read, rename, or explicitly confirmed profile deletion (`?confirm=true`) |
| `GET/POST /api/v1/profiles/{id}/samples` | List/create profile samples |
| `GET/PUT/DELETE /api/v1/profiles/{id}/samples/{sample_id}` | Read/update or explicitly confirmed sample record deletion |

Profile/sample API responses expose opaque asset identifiers only. Asset references are UUIDs, never client paths. Raw stylus data is stored as generated `<uuid>.stroke-v{format_version}.json` files under a sibling `<database-stem>-assets` directory. Run 2 capture emits format version 2 with normalized canvas x/y, per-point timestamps and pointer type, nullable pressure/tilt, ordered strokes with start/end and interruption state, pen-down/up or interruption events, pointer type, and capture canvas dimensions. Omitted pressure and tilt remain absent/null. `POST /api/v1/profiles/normalize` returns a deterministic bbox-normalized copy with metrics and explainable quality problems; it never mutates raw strokes. Stored processed output uses a separate generated `<uuid>.normalized-v1.json` reference. Missing pressure/tilt are valid. Capture drafts and local previews are stored in browser IndexedDB; image upload remains unimplemented. `save_image_asset` and `read_image_asset` store/retrieve bounded JPG/JPEG/PNG/WebP bytes as generated local files, never SQLite blobs; an upload endpoint and image validation/review workflow are later Stage 2 tasks. No arbitrary code execution from content. Avoid saving blank-paper images in PDFs.

## 6. Math conversion strategy
Treat source text as canonical. When Equation Mode is enabled, run a limited parser into styled tokens/runs; it can use superscript/subscript glyphs when supported or explicit raised/lowered positioned runs. Preserve precedence and source ranges. For example:
- Input `x^2 + y^2 = z^2`, ON → visual `x² + y² = z²`.
- Same source, OFF → visual `x^2 + y^2 = z^2`.
- Input `a_1` ON → visual `a₁`; OFF → `a_1`.
- Unsupported syntax remains readable with a warning; never silently erase or reinterpret unrelated caret uses.
Ensure PDF and preview receive identical math runs.

## 7. Rendering adapters and upgrade path

```py
class HandwritingRenderer(Protocol):
    def measure(self, text_or_tokens, style) -> list[float]: ...
    def render_layout_assets(self, positioned_runs, profile_id) -> object: ...

# Stage 1: DemoFontRenderer
# Stage 2: MultiVariantGlyphRenderer
# Stage 3: ContextAwareSynthesisRenderer
```

Separately model layout geometry (width, baseline) from visual drawing paths or font assets. Rendering a new sample must not unexpectedly change line wrapping between preview and PDF. Use deterministic seed + cached assets for natural variations.

## 8. Storage
- `paper_templates`: existing Stage 1 table with id, name, payload JSON and updated timestamp.
- `documents`: id, template_id, profile_id, source_text, settings JSON, revision, timestamps.
- `handwriting_profiles`: id, name, created/updated timestamps, status, sample source list, total sample count, processing status, metadata JSON and data format version.
- `handwriting_samples`: id/profile association, source type, opaque original/processed asset refs, prompt/transcription, label type/text, context, repetition number, dimensions JSON, processing status, quality indicators JSON, creation timestamp and label alignment (`exact`, `unaligned`, `manual`, `unknown`).
- Stylus samples reference versioned JSON files with normalized point coordinates, timestamps, nullable pressure/tilt, stroke boundaries, pointer events/type, available pen metadata and capture canvas dimensions. Raw stroke files are immutable; edits that provide replacement strokes write a new generated file.
- `printer_profiles` (Stage 4): identifier, template/sheet association, settings, calibration matrix, uncertainty.

`backend/app/storage.py` owns SQLite schema versioning (`PRAGMA user_version`). Before pending migration work, it creates a timestamped SQLite backup beside the database using SQLite's backup API. Each migration runs under `BEGIN IMMEDIATE`; statements are executed individually with `execute()` rather than `executescript()`, and DDL plus `user_version` commit or roll back together. Migration 1 creates the profile/sample tables and indexes with `CREATE TABLE IF NOT EXISTS` for the existing Stage 1 template table, preserving its rows. The first connection to a new DB creates schema without a backup because no prior database exists. The default database is `backend/data/paper-templates.sqlite3`; `INKMATCH_DATABASE` can override it for local runs and isolated tests. Image upload API files are not implemented yet; when added, files remain outside public static directories and are served only through scoped APIs.

Coverage thresholds live in `backend/app/coverage_thresholds.json`; the current values are configurable defaults only. No coverage UI or coverage calculation is implemented yet.

## 9. Development environment and commands
Suggested repo structure:

```text
inkmatch/
  PROJECT_SPEC.md
  ARCHITECTURE.md
  AGENTS.md
  README.md
  .gitignore
  frontend/
    src/features/{paper,editor,export,profiles}/
    src/shared/{api,coordinates}/
    tests/
  backend/
    app/{api,paper,math,layout,renderers,pdf,storage,calibration}/
    tests/
  fixtures/
    paper/
    layout/
  scripts/
```

During initial setup Codex should create documented commands for `dev`, `lint`, `typecheck`, `test`, and relevant backend checks. Pin dependencies with lockfiles. Default ports and dev proxy should be explicit in README. Never write secrets into frontend source.

## 10. Testing
- **Unit:** mm/pt transforms, line positions, no-print rectangles, wrapping, pagination, math toggle, rendering metrics, deterministic layout.
- **Integration:** upload → template corrections → text edit → layout → download ink-only PDF, verify PDF media boxes and absence of background images.
- **Browser E2E:** save/reload template and draft; verify live preview; math mode on/off; download PDF.
- **Visual fixtures:** representative ruled paper and headers; compare bounding boxes, not screenshot-only accuracy.
- **Physical:** at least one actual A4 ruled sheet in Stage 1, then repeat print tests after calibration implementation. Record printer settings, selected page size, and baseline offsets in mm.

## 11. Decisions/constraints for Codex
- Stage 1 software is implemented; physical alignment remains unverified. Stage 2 is in progress only within the authorized run/task. Do not implement fake stylus collection or pretend AI personalization exists.
- At the start of implementation, write an actionable, concise task plan and state any assumptions. Preserve the four-stage interface contracts.
- Introduce libraries only when they solve a concrete requirement; explain large dependencies.
- Favor end-to-end working flows over large unfinished UI surfaces.
