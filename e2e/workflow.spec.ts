import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";

test.beforeAll(() => {
  execFileSync(process.env.INKMATCH_PYTHON || "python", [
    "scripts/generate_qa_fixture.py",
  ]);
});

test("live geometry, equations, tabs, custom PDF export and persisted draft", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByText("Local backend connected")).toBeVisible();
  await page
    .getByRole("combobox", { name: "Paper size", exact: true })
    .selectOption("Custom");
  await page.getByLabel("Custom width (mm)").fill("160");
  await page.getByLabel("Custom height (mm)").fill("220");
  await page.getByRole("tab", { name: /Configure Writing Area/ }).click();
  await expect(page.locator(".page")).toHaveAttribute("viewBox", "0 0 160 220");
  await page.getByRole("tab", { name: /Write and Edit/ }).click();
  await expect(page.getByLabel("Equation Mode")).not.toBeChecked();
  const source =
    "Ordinary words and punctuation, x^2 + y^2 = z^2.\nSecond line.";
  await page.getByLabel("Your text").fill(source);
  await expect(page.locator(".ink")).toHaveAttribute(
    "aria-label",
    source.replace("\n", ""),
  );
  await page.getByLabel("Equation Mode").check();
  await expect(page.locator(".ink")).toHaveAttribute(
    "aria-label",
    "Ordinary words and punctuation, x² + y² = z².Second line.",
  );
  await expect(page.getByLabel("Your text")).toHaveValue(source);
  await page.getByLabel("Writing size (mm)").fill("6");
  await page.getByLabel("Ink colour").fill("#a02130");
  await page.getByLabel("Slant (degrees)").fill("12");
  await expect(page.locator(".ink text").first()).toHaveAttribute(
    "font-size",
    "6",
  );
  await expect(page.locator(".ink text").first()).toHaveAttribute(
    "fill",
    "#a02130",
  );
  await page.getByRole("tab", { name: /Preview and Export/ }).click();
  await page.getByLabel("X offset (mm)").fill("2");
  await expect(page.locator(".ink text").first()).toHaveAttribute(
    "data-x-mm",
    "22",
  );
  await page.getByLabel("Printer profile name").fill("InkMatch test printer");
  await page.getByRole("button", { name: "Save current X/Y offsets" }).click();
  await expect(page.getByRole("status")).toContainText("Printer offsets saved");
  const calibration = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download calibration PDF" }).click();
  expect((await calibration).suggestedFilename()).toBe(
    "inkmatch-calibration.pdf",
  );
  await page.getByLabel("X offset (mm)").fill("4");
  await page
    .getByLabel("Saved printer profile")
    .selectOption("InkMatch test printer");
  await expect(page.getByLabel("X offset (mm)")).toHaveValue("2");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download ink-only PDF" }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe("inkmatch-ink-only.pdf");
  await download.saveAs("tmp/qa/custom-ink-only.pdf");
  const before = await page
    .locator(".ink text")
    .first()
    .getAttribute("transform");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.locator(".ink text").first().getAttribute("transform"),
  ).toBe(before);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({ path: "tmp/qa/mobile-export.png", fullPage: true });
  await page.getByRole("tab", { name: /Write and Edit/ }).click();
  await expect(page.getByLabel("Your text")).toHaveValue(source);
  await page.waitForTimeout(600);
  await page.reload();
  await page.getByRole("tab", { name: /Write and Edit/ }).click();
  await expect(page.getByLabel("Your text")).toHaveValue(source);
  await expect(page.getByLabel("Equation Mode")).not.toBeChecked();
  expect(errors).toEqual([]);
});

test("photo upload, manual correction, reviewed crop, saved template and multipage preview", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Local backend connected")).toBeVisible();
  await expect(
    page.getByText(
      "Prepare your sheet, compose on the page, then print only the ink.",
    ),
  ).toBeVisible();
  await page
    .getByLabel(/Upload paper photo/)
    .setInputFiles("tmp/qa/paper-on-desk.png");
  await expect(
    page.getByRole("button", { name: "Preview Corrected Crop" }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Suggested boundary");
  await page
    .getByRole("button", { name: "Top left corner", exact: true })
    .focus();
  await page.keyboard.press("ArrowRight");
  const adjustedCorner = await page.getByLabel("X (%)").first().inputValue();
  await page.getByRole("button", { name: "Preview Corrected Crop" }).click();
  await expect(page.locator(".crop-photo img")).toHaveCount(1);
  await expect(page.locator(".crop-photo")).toHaveCount(1);
  await page.getByRole("button", { name: "Back to Adjust Crop" }).click();
  await expect(page.getByLabel("X (%)").first()).toHaveValue(adjustedCorner);
  await page.getByRole("button", { name: "Preview Corrected Crop" }).click();
  await expect(
    page.getByRole("img", { name: "Corrected paper preview" }),
  ).toBeVisible();
  await expect(page.locator(".page image")).toHaveCount(0);
  await page.getByRole("button", { name: "Accept crop" }).click();
  await expect(
    page.locator(
      ".crop-photo img[alt='Original paper photograph with surroundings']",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Preview Corrected Crop" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: /Configure Writing Area/ }).click();
  await expect(page.locator(".page image")).toHaveCount(1);
  const templateName = `Desk photograph ${Date.now()}`;
  await page.getByLabel("Template name").fill(templateName);
  await page
    .getByRole("button", { name: "Save template", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Template saved");
  await page.getByRole("tab", { name: /Write and Edit/ }).click();
  await page.getByLabel("Your text").fill("A line on real paper.\n".repeat(80));
  expect(await page.locator(".page").count()).toBeGreaterThan(1);
  await expect(page.locator(".page image")).toHaveCount(
    await page.locator(".page").count(),
  );
  await page.screenshot({ path: "tmp/qa/desktop-pages.png", fullPage: false });
  await page.getByRole("tab", { name: /Select Your Paper/ }).click();
  await page.getByRole("button", { name: "Reset to original" }).click();
  await expect(
    page.getByRole("button", { name: "Preview Corrected Crop" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: /Configure Writing Area/ }).click();
  await expect(page.locator(".page image")).toHaveCount(0);
  const savedTemplateOption = page
    .getByLabel("Load a template")
    .locator("option")
    .filter({ hasText: templateName });
  await page
    .getByLabel("Load a template")
    .selectOption((await savedTemplateOption.getAttribute("value")) ?? "");
  await expect(page.locator(".page image")).toHaveCount(
    await page.locator(".page").count(),
  );
  await page.getByRole("button", { name: "Update selected template" }).click();
  await expect(page.getByRole("status")).toContainText("Template updated");
  const pageCount = await page.locator(".page").count();
  await page.waitForTimeout(600);
  await page.reload();
  await page.getByRole("tab", { name: /Configure Writing Area/ }).click();
  await expect(page.locator(".page image")).toHaveCount(pageCount);
});

test("offline preview stays reactive and plain prose remains intact", async ({
  page,
}) => {
  await page.route("**/api/**", (route) => route.abort());
  await page.goto("/");
  await expect(page.getByText("Offline editing available")).toBeVisible();
  await page.getByRole("tab", { name: /Write and Edit/ }).click();
  await page.getByLabel("Your text").fill("Hello, this is ordinary prose!");
  await page.getByLabel("Equation Mode").check();
  await expect(page.locator(".ink")).toHaveAttribute(
    "aria-label",
    "Hello, this is ordinary prose!",
  );
  await page.getByLabel("Letter spacing (mm)").fill("1");
  await page.getByLabel("Writing size (mm)").fill("6");
  await expect(page.locator(".ink text").first()).toHaveAttribute(
    "font-size",
    "6",
  );
});

test("writing boundaries stay separate and can be dragged in physical page coordinates", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: /Select Your Paper/ }).click();
  await expect(page.getByLabel("Left margin (mm)")).toHaveCount(0);
  await page.getByRole("tab", { name: /Configure Writing Area/ }).click();
  const pageBox = await page.locator(".page").boundingBox();
  if (!pageBox) throw new Error("Page preview is unavailable");
  const dragHandle = async (
    selector: string,
    startXmm: number,
    startYmm: number,
    endXmm: number,
    endYmm: number,
  ) => {
    const point = (xMm: number, yMm: number) => ({
      clientX: pageBox.x + (pageBox.width * xMm) / 210,
      clientY: pageBox.y + (pageBox.height * yMm) / 297,
    });
    await page.locator(selector).dispatchEvent("pointerdown", {
      pointerId: 1,
      ...point(startXmm, startYmm),
    });
    await page.locator(".page").dispatchEvent("pointermove", {
      pointerId: 1,
      ...point(endXmm, endYmm),
    });
    await page.locator(".page").dispatchEvent("pointerup", {
      pointerId: 1,
      ...point(endXmm, endYmm),
    });
  };
  await dragHandle('[data-handle="first_baseline_mm"]', 100, 40, 100, 48);
  await expect(page.getByLabel("First baseline (mm)")).toHaveValue("48");
  await dragHandle('[data-handle="left_margin_mm"]', 20, 100, 25, 100);
  await expect(page.getByLabel("Left margin (mm)")).toHaveValue("25");
  await dragHandle('[data-handle="right_margin_mm"]', 190, 100, 188, 100);
  await expect(page.getByLabel("Right margin (mm)")).toHaveValue("22");
  await dragHandle('[data-handle="footer_margin_mm"]', 100, 279, 100, 277);
  await expect(page.getByLabel("Footer exclusion (mm)")).toHaveValue("20");
  const topBoundary = page.getByRole("slider", {
    name: "Top writing boundary",
  });
  await topBoundary.focus();
  await page.keyboard.press("ArrowUp");
  await expect(page.getByLabel("Header exclusion (mm)")).toHaveValue("26");
  await page
    .getByRole("button", { name: "Configure individual baselines" })
    .click();
  await expect(page.getByLabel("Line 1 baseline (mm)")).toHaveValue("48");
  await page.getByLabel("Line 2 baseline (mm)").fill("57");
  await page.getByRole("button", { name: "Add zone" }).click();
  await expect(page.locator(".exclusion-zone")).toHaveCount(1);
  await page.getByLabel("Left (mm)").last().fill("60");
  await page.getByRole("button", { name: "Add zone" }).click();
  await expect(page.locator(".exclusion-zone")).toHaveCount(2);
  await page.getByRole("button", { name: "Delete zone" }).last().click();
  await expect(page.locator(".exclusion-zone")).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel("Line 1 baseline (mm)")).toHaveValue("48");
});

test("uncertain detection supports manual corners, rejects invalid crop, and invalidates edited crops", async ({
  page,
}) => {
  await page.route("**/api/v1/paper/detect", (route) =>
    route.fulfill({
      json: {
        corners: [
          [0.05, 0.05],
          [0.95, 0.05],
          [0.95, 0.95],
          [0.05, 0.95],
        ],
        confidence: "uncertain",
        message:
          "No reliable sheet boundary found. Adjust all four corners before cropping.",
      },
    }),
  );
  await page.goto("/");
  await page
    .getByLabel(/Upload paper photo/)
    .setInputFiles("tmp/qa/paper-on-desk.png");
  await expect(page.getByRole("status")).toContainText("No reliable sheet");
  const groups = [
    "1. Top left",
    "2. Top right",
    "3. Bottom right",
    "4. Bottom left",
  ];
  const corners = [
    [23.7, 8.3],
    [76.4, 13.3],
    [84.6, 89.5],
    [15.5, 92.3],
  ];
  for (let index = 0; index < 4; index++) {
    const group = page.getByRole("group", { name: groups[index], exact: true });
    await group.getByLabel("X (%)").fill(String(corners[index][0]));
    await group.getByLabel("Y (%)").fill(String(corners[index][1]));
  }
  const topLeft = page.getByRole("group", { name: groups[0], exact: true });
  await topLeft.getByLabel("X (%)").fill("95");
  await topLeft.getByLabel("Y (%)").fill("95");
  await page.getByRole("button", { name: "Preview Corrected Crop" }).click();
  await expect(page.getByRole("status")).toContainText("non-crossing");
  await topLeft.getByLabel("X (%)").fill("23.7");
  await topLeft.getByLabel("Y (%)").fill("8.3");
  await page.getByRole("button", { name: "Preview Corrected Crop" }).click();
  await expect(
    page
      .locator(".crop-photo")
      .getByRole("img", { name: "Corrected paper preview" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Accept crop" }).click();
  await expect(
    page.locator(
      ".crop-photo img[alt='Original paper photograph with surroundings']",
    ),
  ).toBeVisible();
  await page.getByRole("tab", { name: /Configure Writing Area/ }).click();
  await expect(page.locator(".page image")).toHaveCount(1);
  await page.getByRole("tab", { name: /Select Your Paper/ }).click();
  const restoredTopLeft = page.getByRole("group", {
    name: groups[0],
    exact: true,
  });
  await restoredTopLeft.getByLabel("X (%)").fill("24");
  await page.getByRole("tab", { name: /Configure Writing Area/ }).click();
  await expect(page.locator(".page image")).toHaveCount(0);
  expect(await page.locator("body").innerText()).not.toContain("\u2014");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({ path: "tmp/qa/mobile-crop.png", fullPage: true });
});
