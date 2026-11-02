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
  await expect(
    page.getByRole("img", { name: "Document page 1" }),
  ).toHaveAttribute("viewBox", "0 0 160 220");
  await page.getByRole("tab", { name: /Writing Editor/ }).click();
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
  await page.getByRole("tab", { name: /Writing Editor/ }).click();
  await expect(page.getByLabel("Your text")).toHaveValue(source);
  await page.waitForTimeout(600);
  await page.reload();
  await page.getByRole("tab", { name: /Writing Editor/ }).click();
  await expect(page.getByLabel("Your text")).toHaveValue(source);
  await expect(page.getByLabel("Equation Mode")).not.toBeChecked();
  expect(errors).toEqual([]);
});

test("photo upload, manual correction, reviewed crop, saved template and multipage preview", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Local backend connected")).toBeVisible();
  await page
    .getByLabel(/Upload paper photo/)
    .setInputFiles("tmp/qa/paper-on-desk.png");
  await expect(
    page.getByRole("button", { name: "Preview corrected crop" }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Suggested boundary");
  await page
    .getByRole("button", { name: "Top left corner", exact: true })
    .focus();
  await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "Preview corrected crop" }).click();
  await expect(
    page.getByRole("img", { name: "Corrected crop awaiting confirmation" }),
  ).toBeVisible();
  await expect(page.locator(".page image")).toHaveCount(0);
  await page.getByRole("button", { name: "Accept crop" }).click();
  await expect(page.locator(".page image")).toHaveCount(1);
  await page.getByLabel("Template name").fill("Desk photograph");
  await page
    .getByRole("button", { name: "Save template", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Template saved locally",
  );
  await page.getByRole("tab", { name: /Writing Editor/ }).click();
  await page.getByLabel("Your text").fill("A line on real paper.\n".repeat(80));
  expect(await page.locator(".page").count()).toBeGreaterThan(1);
  await expect(page.locator(".page image")).toHaveCount(
    await page.locator(".page").count(),
  );
  await page.screenshot({ path: "tmp/qa/desktop-pages.png", fullPage: false });
  await page.getByRole("tab", { name: /Paper Setup/ }).click();
  await page.getByRole("button", { name: "Reset to original" }).click();
  await expect(page.locator(".page image")).toHaveCount(0);
  await page.getByLabel("Load a template").selectOption("Desk photograph");
  await expect(page.locator(".page image")).toHaveCount(
    await page.locator(".page").count(),
  );
  const pageCount = await page.locator(".page").count();
  await page.waitForTimeout(600);
  await page.reload();
  await expect(page.locator(".page image")).toHaveCount(pageCount);
});

test("offline preview stays reactive and plain prose remains intact", async ({
  page,
}) => {
  await page.route("**/api/**", (route) => route.abort());
  await page.goto("/");
  await expect(page.getByText("Offline editing available")).toBeVisible();
  await page.getByRole("tab", { name: /Writing Editor/ }).click();
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
  await page.getByRole("button", { name: "Preview corrected crop" }).click();
  await expect(page.getByRole("status")).toContainText("non-crossing");
  await topLeft.getByLabel("X (%)").fill("23.7");
  await topLeft.getByLabel("Y (%)").fill("8.3");
  await page.getByRole("button", { name: "Preview corrected crop" }).click();
  await page.getByRole("button", { name: "Accept crop" }).click();
  await expect(page.locator(".page image")).toHaveCount(1);
  await topLeft.getByLabel("X (%)").fill("24");
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
