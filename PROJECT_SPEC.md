# InkMatch — Product Specification

**Status:** Working product specification (not final).  
**Primary delivery:** Web application first; optional Windows printing companion later.  
**Objective:** Learn a user's own handwriting, render typed content in that style on top of a photograph/scan of their real paper, and export a precisely positioned **ink-only** PDF for printing onto that same physical paper.

## 1. Non-negotiable product behavior

1. A user can build a handwriting profile in any of three ways: (a) upload photos/scans of handwritten notes, (b) follow guided prompts and write with a touchscreen/stylus, or (c) combine both. Neither route is mandatory if the other is used.
2. Guided training prompts include uppercase/lowercase English letters, digits, punctuation, common letter pairs, words, and sentences. A user can contribute multiple instances of the same character and relevant connections; stylus samples capture strokes and timing where available and pressure only if the hardware/browser provides it.
3. Handwriting output should aim to resemble the user's writing, with character variants, natural spacing and, eventually, context-aware connections/cursive forms. **Do not claim this is achieved by installing a decorative font.** High-fidelity synthesis is an advanced development target, not an MVP guarantee.
4. User uploads a photo/scan of the *blank physical paper they will print on*. They may configure paper layout **automatically, manually, or by correcting automatic suggestions**: physical page size, perspective/crop, header exclusions, first writable baseline, ruled-line positions or spacing, left/right boundaries, footer exclusion and any extra no-print zones. A photograph alone does not establish physical dimensions; require a known size/reference.
5. After configuration, the **uploaded paper image is the live editor background**. Typing immediately displays text in the selected handwriting style on that paper (Option A). Rendering can be debounced/cached for responsiveness but must feel live. In Stage 1 a clearly labeled temporary font is acceptable.
6. Global formatting controls: writing size, letter spacing, word spacing, line/ruled-baseline placement, slant, ink color, variation strength (when real variants exist), paragraph spacing and indentation as feasible. No need for per-letter/per-word drag-and-drop editing.
7. An **Equation Mode toggle** controls interpretation of supported plain-text math input. With it on, `x^2 + y^2 = z^2` appears as `x² + y² = z²`, not literally with carets. With it off, the input is treated as ordinary literal text. Support common superscripts, subscripts and operators initially; more advanced mathematical layout is an enhancement. Equations still use the user's handwriting profile when supported; unsupported glyphs require a clearly labeled fallback, not silent omission.
8. The editor supports English, digits, punctuation, and mathematical symbols. Preserve typed content, whitespace and paragraph breaks; wrap using actual rendered text widths. Support multi-page output using configured physical line positions.
9. Preview blends handwriting with the uploaded paper. **Printable PDF contains only generated handwriting/selected intentional text, never the uploaded paper image, existing ruled lines or headers.** PDF page size and positions match the physical sheet; test with real printouts.
10. Provide a separate, reusable paper template and handwriting profile. Later provide reusable printer calibration profiles, with measured X/Y offsets and optionally scale/skew; do not promise universally perfect printing because printer feeds vary.
11. User data should remain private by design: do not upload handwriting or notes to third-party AI APIs by default. Offer local/self-hosted processing where practical, define retention/deletion behavior, and avoid storing sensitive materials unnecessarily.

## 2. Main user journeys

### New user: handwriting profile
- Choose **Upload notes**, **Write with stylus**, or **Combine**.
- For scanned notes: upload images; crop/correct orientation; process and show what was recognized; offer transcription or manual correction where required. Unstructured notes are harder than labeled samples. Never pretend segmentation/recognition is guaranteed.
- For stylus: show a particular letter/word/sentence and an ink canvas; capture multiple samples, clear/retry, save, inspect progress and fill missing characters. Mouse/touch are fallback input methods.
- Save and name a reusable profile; show coverage and a sample preview. Profile may start as a glyph library and improve with later synthesis.

### New document: paper setup and typing
- Upload or choose a saved blank-paper template.
- Specify a physical paper size (e.g., A4) and orientation; perspective-correct the image if possible.
- Choose **Auto detect**, **Manual configure**, or **Auto + edit**. Make editable line and margin overlays accessible and visible.
- Choose a handwriting profile; if the user has none in Stage 1, select **Demo handwriting font** with unmistakable demo labeling.
- Type directly into the document editor; the uploaded paper remains behind the rendered text. Editor should expose an accessible text input, caret/selection or equivalent editing experience, and update overlay promptly.
- Use global settings and the **Equation Mode** toggle. Preview pagination and print-safe bounds; warn before clipping.
- Export ink-only PDF at 100% physical size. Download preview composite separately if useful, but label it **NOT FOR PRINTING ON PREPRINTED PAPER**.

### Printing
- User loads matching physical paper in printer; selects **Actual size / 100%** with no fit-to-page scaling.
- Initial web product offers test-print instructions and adjustment of alignment offsets; later Windows companion can support printer identity, calibration artifacts and profile management.
- Maintain separate template layout coordinates from printer-specific adjustment offsets.

## 3. Scope by four delivery stages

### Stage 1 — Functional web editor, paper templates, PDF and first physical alignment test
**Included:** React web UI; blank-paper photo upload; paper-size registration; automatic line/margin detection as a *best-effort assist*; full manual configuration/correction; live editor over paper image; demo font only, clearly labeled; global controls; Equation Mode for common exponent/subscript formats; word wrapping/pagination; document persistence; export ink-only PDF; optional composite preview; simple X/Y print offsets and test-print guide. **Do at least one real-paper alignment test before closing Stage 1.**

**Not included:** claiming custom handwriting learned from images, stylus handwriting-profile training, context-aware handwriting synthesis, full printer driver automation, advanced equation typesetting.

**Acceptance:** exported PDF has correct page dimensions and *no visible background/paper pixels*; page preview and printed positions use the same geometric layout; manual edits persist; equation toggle behaves correctly; multi-page content does not spill into header/margins; measured alignment error can be recorded from a test print.

### Stage 2 — Profile acquisition and usable personal glyphs
**Included:** notes upload/annotation pipeline, guided stylus capture with repeats, combined inputs, image cleanup and sample labeling, glyph variants and coverage reporting, reusable profiles; basic glyph-based renderer in live editor.

**Acceptance:** user can produce a paragraph from their own captured samples, identify missing characters and redo bad samples; variants are demonstrably used where available. Clearly communicate limitations of connected/cursive writing.

### Stage 3 — Higher-fidelity handwriting synthesis
**Included:** evaluate and adapt suitable existing models or methods; contextual variants, ligatures/connected strokes, style-preserving variation; caching and performance tuning; realistic mathematical symbol fallback policy.

**Acceptance:** representative held-out comparisons and user evaluation show improvement over Stage 2; repeated letters do not trivially reuse a single stamp; output is legible and still follows page constraints. Do not promise perfect fidelity.

### Stage 4 — Printing calibration and product hardening
**Included:** printer calibration workflow, printer and feed-orientation profiles, repeated real-paper tests, physical offset/scale corrections, optional Windows companion if necessary, robust multi-page printing, quality/safety/privacy review.

**Acceptance:** repeated measured tests across representative paper/printer combinations; recorded alignment error and variance; documented failure/warning behavior and printer-specific limits.

## 4. Detailed requirements

### Paper layout
- Keep **paper image coordinates** (for background display) separate from **physical page coordinates** (mm or points) and **screen coordinates** (CSS px).
- Rectify/crop source image onto known physical page dimensions; guide manual adjustment if unreliable.
- Store individual line baselines when spacing is irregular; allow fixed line-spacing mode when uniform.
- Manual correction always wins over automatic suggestions; avoid overwriting edits upon subsequent detection.
- Support exclusions such as name/date header, first writable line, right margin, footer; consider first-page versus continuation-page templates.

### Document layout and preview
- One deterministic layout calculation should power browser preview and PDF output; don't independently recalculate line breaks in the frontend and backend.
- Place rendered glyphs relative to ruled baselines, including ascenders/descenders. Recompute wrapping/pagination after relevant changes.
- Keep editable *plain source text* separate from generated visual handwriting. Never replace source with a flattened raster.
- Respect Unicode symbols and explicit line breaks. Warn about unrenderable characters.
- Don't generate fake jitter that causes line crossing; random variation must be reproducible from a stable seed during editing/printing.

### Equation Mode
- On: interpret a documented **limited plain-text grammar** (e.g., `x^2`, `a_1`, `+ - = / × ÷ ≤ ≥ ≠ ± √`) into mathematical display characters/positioning. `^` and `_` are operators only when recognized; escaped/unsupported sequences should remain intact and visibly flagged.
- Off: render exactly what user typed, including `^` and `_`.
- User should always be able to inspect and edit their source text; toggle does not destructively rewrite it.
- This is *not* a full LaTeX editor or symbolic math engine in the initial release. Expression rendering must prefer handwriting glyphs where available.

### Printing and export
- A4 and common standard paper sizes first, with manual custom dimensions; preserve correct PDF media box.
- Print PDF must contain handwriting layer only. Do not add white fill rectangles hiding physical paper; an empty PDF page background is normal.
- Include 100%-scale instructions, feed orientation guidance and checks for printer nonprintable regions.
- Output quality must be testable in physical units, not screenshot pixels.

### Accessibility, quality and privacy
- Keyboard-accessible UI controls, clear labeling and usable contrast; support touch/stylus without preventing normal text editing.
- Handle unsupported files, huge uploads, malformed images and missing samples with specific errors.
- Avoid storing original handwriting photos permanently without a reason; implement explicit user-controlled deletion when persistence is added.
- Never silently send samples to external ML services.

## 5. Explicit non-goals for Stage 1
- No claim of matching an individual person's handwriting yet.
- No full neural handwriting model.
- No equation WYSIWYG/typesetting editor and no support guarantee for complex fractions, matrices or integrals.
- No printer-specific automatic driver control.
- No user accounts, payments, social sharing or mobile app unless separately approved.

## 6. Success measurements
- **Layout:** actual PDF physical width/height match selected paper; header and margin exclusion violations = 0 in fixture tests.
- **Print:** baseline offset in millimeters, recorded before/after manually applied corrections; repeatability over several paper feeds.
- **Handwriting (Stages 2–3):** character coverage, sample rejection rate, repeated-glyph diversity, legibility and similarity ratings on held-out examples.
- **UX:** user can set up a paper and produce an ink-only printable PDF without manipulating external design software.

## 7. Open implementation choices, not blockers
Exact hosting, long-term storage, model selection, stylus tablet API support, printer brand, and tolerances are deferred until relevant stages. The architecture must keep these replaceable.
