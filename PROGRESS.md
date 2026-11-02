# InkMatch Progress

## Implemented

- React/Vite + FastAPI foundation and local dev/test/build scripts.
- Three responsive, keyboard-accessible workflow tabs: Paper Setup, Writing Editor, Preview and Export.
- Reactive controls for text, writing size, spacing, colour, slant, baselines, margins, header/footer, dimensions, orientation and XY print offsets.
- One deterministic TypeScript layout/parser module executes both in-browser (immediate offline preview) and through a Python/Node adapter (layout API and PDF). Shared licensed font and exact advance metrics; preserved whitespace, explicit breaks, word wrapping and pagination.
- Equation Mode OFF on each reopening, conservative recognition, literal prose/unsupported syntax, preserved source and visible glyph/syntax warnings.
- Validated A4/Letter/custom dimensions, retained custom values, predictable orientation, exact PDF media boxes.
- Local JPG/JPEG/PNG upload, best-effort four-corner boundary detection, manual pointer/keyboard/numeric adjustment, perspective crop preview and explicit acceptance. Original retained for reset/reprocessing; corner edits invalidate the accepted crop. Separate reviewed printed-line suggestions.
- IndexedDB draft autosave and named reusable templates retaining original photo, crop and manual corrections. Legacy numeric settings preserved. Invalid geometry does not discard saved source text.
- SVG preview paints canonical mm positions on the confirmed paper at its exact page boundaries. Ink-only PDF uses the same font, positions, sizes, slant and colour, without images or background drawing.
- Validation prevents invalid geometry and physical clipping; actual-size print guidance is visible.

## Design decisions

- Reused the React/Vite/FastAPI/ReportLab foundation, API paths and existing tests; replaced the broken approximate layout and independent frontend substitutions with one shared implementation.
- Node.js 24+ runs the same TypeScript engine from Python, avoiding a second parser/layout algorithm and stale network responses during editing. No mandatory cloud service.
- Bitstream Vera italic is an explicitly labeled temporary demo, not personal handwriting. License and generated metrics are checked in.
- OpenCV/Pillow perform local image validation, boundary/line analysis and homography; images stay in memory on the backend. Templates remain browser-local in this slice.
- Crop candidates and detected lines require explicit user acceptance. Changes never silently overwrite confirmed geometry.

## Verification

- Regression coverage includes prose/math/session toggling, live offline settings, custom dimensions/orientation, tab state, template/draft reload, invalid uploads/settings, perspective cropping with surroundings/lighting, manual fallback, page boundaries, PDF dimensions and positioned glyph origins.
- Real Chrome end-to-end tests exercise upload/crop/accept/save/reload, multiple pages, export download, mobile geometry, offline editing and manual failure recovery.
- Final test counts/results are recorded after the final verification run below.

## Remaining limits / next work

- Review representative real phone photos and complete the required physical paper alignment test. Synthetic photograph-like fixtures cannot establish real camera robustness or printer accuracy.
- Four corners assume a planar sheet; heavy shadows, curved pages, occlusion and similar desk/paper colours can require manual correction.
- Irregular individual baselines, extra no-print rectangles and a backend SQLite template/document library remain incomplete Stage 1 extensions. Current templates/drafts persist in the same browser.
- Demo font coverage is limited; unsupported characters retain source and show a labeled fallback. Advanced mathematical typesetting remains out of scope.
- Stage 1 remains open pending the above limits and physical verification. No Stage 2 acquisition or personalization has been implemented.
