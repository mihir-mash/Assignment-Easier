import metricsData from "./font-metrics.json" with { type: "json" };
import { parseTokens } from "./equations.ts";

export type Settings = {
  width_mm: number;
  height_mm: number;
  font_size_mm: number;
  letter_spacing_mm: number;
  word_spacing_mm: number;
  line_spacing_mm: number;
  first_baseline_mm: number;
  left_margin_mm: number;
  right_margin_mm: number;
  footer_margin_mm: number;
  header_margin_mm: number;
  ink_color: string;
  slant_deg: number;
  offset_x_mm: number;
  offset_y_mm: number;
  equation_mode: boolean;
  line_baselines_mm: number[];
  exclusion_zones_mm: ExclusionZone[];
};
export type ExclusionZone = {
  x_mm: number;
  y_mm: number;
  width_mm: number;
  height_mm: number;
};
export const defaults: Settings = {
  width_mm: 210,
  height_mm: 297,
  font_size_mm: 5,
  letter_spacing_mm: 0.15,
  word_spacing_mm: 0.6,
  line_spacing_mm: 8,
  first_baseline_mm: 40,
  left_margin_mm: 20,
  right_margin_mm: 20,
  footer_margin_mm: 18,
  header_margin_mm: 25,
  ink_color: "#263832",
  slant_deg: 0,
  offset_x_mm: 0,
  offset_y_mm: 0,
  equation_mode: false,
  line_baselines_mm: [],
  exclusion_zones_mm: [],
};
export type Run = {
  text: string;
  draw_text: string;
  x_mm: number;
  baseline_y_mm: number;
  width_mm: number;
  font_size_mm: number;
  source_range: [number, number];
  kind: string;
  ink_color: string;
  slant_deg: number;
};
export type Page = {
  page_index: number;
  width_mm: number;
  height_mm: number;
  runs: Run[];
  warnings: string[];
};
export type Layout = { pages: Page[]; warnings: string[] };
const metrics = metricsData as Record<string, number>;

export function validateSettings(s: Settings): string[] {
  const errors: string[] = [];
  const limits: Partial<Record<keyof Settings, [number, number]>> = {
    width_mm: [50, 1000],
    height_mm: [50, 1000],
    font_size_mm: [1, 20],
    letter_spacing_mm: [0, 5],
    word_spacing_mm: [0, 15],
    line_spacing_mm: [2, 50],
    first_baseline_mm: [1, 999],
    left_margin_mm: [0, 500],
    right_margin_mm: [0, 500],
    header_margin_mm: [0, 500],
    footer_margin_mm: [0, 500],
    slant_deg: [-25, 25],
    offset_x_mm: [-30, 30],
    offset_y_mm: [-30, 30],
  };
  for (const [key, bounds] of Object.entries(limits)) {
    const value = s[key as keyof Settings];
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < bounds[0] ||
      value > bounds[1]
    )
      errors.push(
        `${key.replaceAll("_", " ")} must be ${bounds[0]} to ${bounds[1]}.`,
      );
  }
  if (s.left_margin_mm + s.right_margin_mm + s.font_size_mm * 2 >= s.width_mm)
    errors.push("Margins leave too little writing width.");
  if (
    (!s.line_baselines_mm.length &&
      s.first_baseline_mm < s.header_margin_mm + s.font_size_mm) ||
    (!s.line_baselines_mm.length &&
      s.first_baseline_mm + s.font_size_mm * 0.3 >
        s.height_mm - s.footer_margin_mm)
  )
    errors.push(
      "First baseline must leave room for letters below the header and above the footer.",
    );
  if (!s.line_baselines_mm.length && s.line_spacing_mm < s.font_size_mm * 1.25)
    errors.push(
      "Line spacing must be at least 1.25 times writing size to prevent overlap.",
    );
  if (!/^#[0-9a-fA-F]{6}$/.test(s.ink_color))
    errors.push("Choose a valid six-digit ink color.");
  if (
    !Array.isArray(s.line_baselines_mm) ||
    s.line_baselines_mm.length > 200 ||
    s.line_baselines_mm.some((value) => !Number.isFinite(value))
  ) {
    errors.push(
      "Individual line baselines must contain at most 200 finite millimetre positions.",
    );
  } else if (s.line_baselines_mm.length) {
    const ys = s.line_baselines_mm;
    if (
      ys.some(
        (value) =>
          value < s.header_margin_mm + s.font_size_mm ||
          value + s.font_size_mm * 0.3 > s.height_mm - s.footer_margin_mm,
      )
    )
      errors.push(
        "Individual baselines must stay inside the writable top and bottom boundaries.",
      );
    if (
      ys.some(
        (value, index) =>
          index > 0 && value - ys[index - 1] < s.font_size_mm * 1.25,
      )
    )
      errors.push(
        "Individual baselines must be ordered and spaced far enough apart for the writing size.",
      );
  }
  if (
    !Array.isArray(s.exclusion_zones_mm) ||
    s.exclusion_zones_mm.length > 50
  ) {
    errors.push("Use at most 50 writing exclusion zones.");
  } else
    for (const zone of s.exclusion_zones_mm) {
      if (
        ![zone.x_mm, zone.y_mm, zone.width_mm, zone.height_mm].every(
          Number.isFinite,
        ) ||
        zone.x_mm < 0 ||
        zone.y_mm < 0 ||
        zone.width_mm <= 0 ||
        zone.height_mm <= 0 ||
        zone.x_mm + zone.width_mm > s.width_mm ||
        zone.y_mm + zone.height_mm > s.height_mm
      )
        errors.push(
          "Exclusion zones must have positive dimensions and stay inside the physical paper.",
        );
    }
  return errors;
}

export function layoutDocument(source: string, settings: Settings): Layout {
  const errors = validateSettings(settings);
  if (errors.length) return { pages: [], warnings: errors };
  if (source.length > 20000)
    return { pages: [], warnings: ["Text is limited to 20,000 characters."] };
  const s = settings;
  const tokens = parseTokens(source, s.equation_mode);
  const warnings = new Set<string>();
  if (s.equation_mode && tokens.some((t) => t.text === "^" || t.text === "_"))
    warnings.add("Unrecognized math syntax is displayed literally.");
  const pages: Page[] = [];
  let baselineIndex = 0;
  let baseline = s.line_baselines_mm[0] ?? s.first_baseline_mm;
  let x = s.left_margin_mm;
  // Conservative italic/slant overhang reserve, identical for preview and PDF.
  const overhang =
    s.font_size_mm * (0.25 + Math.abs(Math.tan((s.slant_deg * Math.PI) / 180)));
  const right = s.width_mm - s.right_margin_mm - overhang;
  const newPage = () => {
    pages.push({
      page_index: pages.length,
      width_mm: s.width_mm,
      height_mm: s.height_mm,
      runs: [],
      warnings: [],
    });
    baselineIndex = 0;
    baseline = s.line_baselines_mm[0] ?? s.first_baseline_mm;
  };
  newPage();
  const newLine = () => {
    x = s.left_margin_mm;
    if (s.line_baselines_mm.length) {
      baselineIndex++;
      if (baselineIndex >= s.line_baselines_mm.length) newPage();
      else baseline = s.line_baselines_mm[baselineIndex];
    } else {
      baseline += s.line_spacing_mm;
      if (baseline + s.font_size_mm * 0.3 > s.height_mm - s.footer_margin_mm)
        newPage();
    }
  };
  const width = (index: number) => {
    const token = tokens[index];
    const unit =
      metrics[String(token.drawText.codePointAt(0))] ?? metrics["63"];
    return (
      unit * s.font_size_mm * token.scale +
      s.letter_spacing_mm +
      (/\s/.test(token.text) ? s.word_spacing_mm : 0)
    );
  };
  let zoneAdvanceCount = 0;
  const movePastExclusions = (
    advanceMm: number,
    riseMm: number,
    scale: number,
  ): boolean => {
    while (true) {
      const runBaselineMm = baseline + riseMm * s.font_size_mm + s.offset_y_mm;
      const runFontMm = s.font_size_mm * scale;
      const topMm = runBaselineMm - runFontMm;
      const bottomMm = runBaselineMm + runFontMm * 0.3;
      const zone = s.exclusion_zones_mm.find(
        (candidate) =>
          topMm < candidate.y_mm + candidate.height_mm &&
          bottomMm > candidate.y_mm &&
          x + s.offset_x_mm - overhang < candidate.x_mm + candidate.width_mm &&
          x + s.offset_x_mm + advanceMm + overhang > candidate.x_mm,
      );
      if (!zone) return true;
      x = zone.x_mm + zone.width_mm + overhang - s.offset_x_mm;
      if (x + advanceMm <= right) continue;
      newLine();
      zoneAdvanceCount++;
      if (zoneAdvanceCount > 1000) return false;
    }
  };
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token.text === "\r") {
      newLine();
      if (tokens[index + 1]?.text === "\n") index++;
      continue;
    }
    if (token.text === "\n") {
      newLine();
      continue;
    }
    if (token.text === "\t") {
      token.drawText = " ";
    }
    // Keep words together when they fit a line; long words split safely by glyph.
    if (
      !/\s/.test(token.text) &&
      (index === 0 || /\s/.test(tokens[index - 1].text))
    ) {
      let wordWidth = 0;
      for (
        let cursor = index;
        cursor < tokens.length && !/\s/.test(tokens[cursor].text);
        cursor++
      )
        wordWidth += width(cursor);
      if (!movePastExclusions(wordWidth, token.rise, token.scale))
        return {
          pages: [],
          warnings: [
            "No configured baseline can avoid the writing exclusion zones.",
          ],
        };
      if (wordWidth <= right - s.left_margin_mm && x + wordWidth > right)
        newLine();
    }
    const advance = width(index);
    if (!movePastExclusions(advance, token.rise, token.scale))
      return {
        pages: [],
        warnings: [
          "No configured baseline can avoid the writing exclusion zones.",
        ],
      };
    if (x + advance > right && x > s.left_margin_mm) newLine();
    const missing =
      metrics[String(token.drawText.codePointAt(0))] === undefined;
    if (missing)
      warnings.add(
        `Unsupported character ${token.text}, shown as ?. Source is preserved.`,
      );
    const run: Run = {
      text: token.text,
      draw_text: missing ? "?" : token.drawText,
      x_mm: x + s.offset_x_mm,
      baseline_y_mm: baseline + token.rise * s.font_size_mm + s.offset_y_mm,
      width_mm: advance,
      font_size_mm: s.font_size_mm * token.scale,
      source_range: token.source_range,
      kind: token.kind,
      ink_color: s.ink_color,
      slant_deg: s.slant_deg,
    };
    if (
      run.x_mm - overhang < 0 ||
      run.x_mm + advance + overhang > s.width_mm ||
      run.baseline_y_mm - run.font_size_mm < 0 ||
      run.baseline_y_mm + run.font_size_mm * 0.3 > s.height_mm
    )
      warnings.add(
        "Print offsets move ink outside the sheet. Reduce offsets before export.",
      );
    pages[pages.length - 1].runs.push(run);
    x += advance;
  }
  return { pages, warnings: [...warnings] };
}
