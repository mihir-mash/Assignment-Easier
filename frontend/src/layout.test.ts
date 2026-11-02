import { describe, expect, test } from "vitest";
import {
  defaults,
  layoutDocument,
  validateSettings,
} from "../../shared/layout";
import { parseTokens } from "../../shared/equations";

describe("conservative equation grammar", () => {
  test.each([
    "Ordinary words, letters and punctuation stay intact!",
    "Email file_name and hello_world.",
    "abc^2 should stay literal; x^word stays too.",
    String.raw`Escaped \x^2 remains source.`,
  ])("preserves prose: %s", (source) => {
    expect(
      parseTokens(source, true)
        .map((token) => token.text)
        .join(""),
    ).toBe(source);
  });
  test("formats only recognized expressions in mixed prose and retains source ranges", () => {
    const source = "Pythagoras: x^2 + y^2 = z^2. Index a_12.";
    expect(
      parseTokens(source, true)
        .map((token) => token.text)
        .join(""),
    ).toBe("Pythagoras: x² + y² = z². Index a₁₂.");
    expect(
      parseTokens(source, false)
        .map((token) => token.text)
        .join(""),
    ).toBe(source);
    const token = parseTokens("x^2", true)[1];
    expect(token.source_range).toEqual([2, 3]);
    expect(token.drawText).toBe("2");
  });
});

describe("canonical physical layout", () => {
  test("uses actual font widths and preserves explicit paragraphs and whitespace", () => {
    const result = layoutDocument("Wi  i\n\nlast", defaults);
    const runs = result.pages[0].runs;
    expect(runs[0].width_mm).toBeGreaterThan(runs[1].width_mm);
    expect(runs.filter((run) => run.text === " ")).toHaveLength(2);
    expect(runs.at(-1)!.baseline_y_mm).toBe(
      defaults.first_baseline_mm + 2 * defaults.line_spacing_mm,
    );
  });
  test("wraps words and paginates within physical margins", () => {
    const settings = {
      ...defaults,
      width_mm: 100,
      height_mm: 100,
      first_baseline_mm: 25,
      header_margin_mm: 10,
    };
    const result = layoutDocument("word ".repeat(300), settings);
    expect(result.pages.length).toBeGreaterThan(1);
    for (const page of result.pages)
      for (const run of page.runs) {
        expect(run.x_mm).toBeGreaterThanOrEqual(settings.left_margin_mm);
        expect(run.x_mm + run.width_mm).toBeLessThan(
          settings.width_mm - settings.right_margin_mm,
        );
        expect(run.baseline_y_mm).toBeLessThanOrEqual(
          settings.height_mm - settings.footer_margin_mm,
        );
      }
    expect(result).toEqual(layoutDocument("word ".repeat(300), settings));
  });
  test("reacts to all settings without a server or viewport geometry", () => {
    const original = layoutDocument("Hello world x^2", defaults);
    const changed = layoutDocument("Hello world x^2", {
      ...defaults,
      width_mm: 150,
      height_mm: 200,
      font_size_mm: 6,
      letter_spacing_mm: 0.4,
      word_spacing_mm: 2,
      ink_color: "#ff0000",
      slant_deg: 12,
      first_baseline_mm: 50,
      left_margin_mm: 25,
      line_spacing_mm: 10,
      equation_mode: true,
      offset_x_mm: 2,
      offset_y_mm: 3,
    });
    expect(changed.pages[0].width_mm).toBe(150);
    expect(changed.pages[0].runs[0]).toMatchObject({
      x_mm: 27,
      baseline_y_mm: 53,
      font_size_mm: 6,
      ink_color: "#ff0000",
      slant_deg: 12,
    });
    expect(changed.pages[0].runs.map((run) => run.text).join("")).toContain(
      "x²",
    );
    expect(changed).not.toEqual(original);
  });
  test("uses irregular baseline positions and routes text around exclusions", () => {
    const settings = {
      ...defaults,
      width_mm: 120,
      height_mm: 100,
      first_baseline_mm: 40,
      line_baselines_mm: [40, 53, 71],
      exclusion_zones_mm: [{ x_mm: 20, y_mm: 35, width_mm: 28, height_mm: 10 }],
    };
    const result = layoutDocument("A\nB\nC\nD", settings);
    expect(result.pages).toHaveLength(2);
    const runs = result.pages
      .flatMap((page) => page.runs)
      .filter((run) => run.text !== "\n");
    expect(runs.map((run) => run.baseline_y_mm)).toEqual([40, 53, 71, 40]);
    for (const run of runs) {
      const intersects =
        run.x_mm < 48 &&
        run.x_mm + run.width_mm > 20 &&
        run.baseline_y_mm - run.font_size_mm < 45 &&
        run.baseline_y_mm + run.font_size_mm * 0.3 > 35;
      expect(intersects).toBe(false);
    }
  });
  test.each([0, -1, 1001, Number.NaN])(
    "rejects invalid custom width %s",
    (width_mm) => {
      expect(
        validateSettings({ ...defaults, width_mm }).length,
      ).toBeGreaterThan(0);
    },
  );
});
