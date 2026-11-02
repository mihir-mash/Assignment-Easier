import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { App } from "./App";
import { readStored, writeStored } from "./storage";

beforeEach(async () => {
  await writeStored("draft", null);
  await writeStored("templates", []);
  localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new Error("Backend offline")),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
async function openApp() {
  render(<App />);
  await screen.findByText("Offline editing available");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

test("defaults Equation Mode off, toggles conservatively, and preserves source across tabs", async () => {
  await openApp();
  fireEvent.click(screen.getByRole("tab", { name: /Writing Editor/ }));
  const input = screen.getByLabelText("Your text");
  const source = "Ordinary prose, x^2 + y^2 = z^2.";
  fireEvent.change(input, { target: { value: source } });
  expect(screen.getByLabelText("Equation Mode")).not.toBeChecked();
  expect(document.querySelector(".ink")).toHaveAttribute("aria-label", source);
  fireEvent.click(screen.getByLabelText("Equation Mode"));
  expect(document.querySelector(".ink")).toHaveAttribute(
    "aria-label",
    "Ordinary prose, x² + y² = z².",
  );
  expect(input).toHaveValue(source);
  fireEvent.click(screen.getByRole("tab", { name: /Preview and Export/ }));
  fireEvent.click(screen.getByRole("tab", { name: /Writing Editor/ }));
  expect(screen.getByLabelText("Your text")).toHaveValue(source);
  expect(screen.getByLabelText("Equation Mode")).toBeChecked();
  fireEvent.click(screen.getByLabelText("Equation Mode"));
  expect(document.querySelector(".ink")).toHaveAttribute("aria-label", source);
});

test("custom dimensions are reactive, orientation swaps predictably and presets retain custom values", async () => {
  await openApp();
  fireEvent.change(screen.getByLabelText("Paper size"), {
    target: { value: "Custom" },
  });
  fireEvent.change(screen.getByLabelText("Custom width (mm)"), {
    target: { value: "160" },
  });
  fireEvent.change(screen.getByLabelText("Custom height (mm)"), {
    target: { value: "220" },
  });
  expect(screen.getByRole("img", { name: "Document page 1" })).toHaveAttribute(
    "viewBox",
    "0 0 160 220",
  );
  fireEvent.change(screen.getByLabelText("Orientation"), {
    target: { value: "landscape" },
  });
  expect(screen.getByRole("img", { name: "Document page 1" })).toHaveAttribute(
    "viewBox",
    "0 0 220 160",
  );
  fireEvent.change(screen.getByLabelText("Paper size"), {
    target: { value: "A4" },
  });
  fireEvent.change(screen.getByLabelText("Paper size"), {
    target: { value: "Custom" },
  });
  expect(screen.getByLabelText("Custom width (mm)")).toHaveValue(160);
  fireEvent.change(screen.getByLabelText("Custom width (mm)"), {
    target: { value: "0" },
  });
  expect(screen.getByRole("alert")).toHaveTextContent(
    "height mm must be 50 to 1000",
  );
});

test("writing controls immediately change SVG geometry, colour and slant while offline", async () => {
  await openApp();
  fireEvent.click(screen.getByRole("tab", { name: /Writing Editor/ }));
  fireEvent.change(screen.getByLabelText("Writing size (mm)"), {
    target: { value: "6" },
  });
  fireEvent.change(screen.getByLabelText("Letter spacing (mm)"), {
    target: { value: ".5" },
  });
  fireEvent.change(screen.getByLabelText("Word spacing (mm)"), {
    target: { value: "2" },
  });
  fireEvent.change(screen.getByLabelText("Ink colour"), {
    target: { value: "#ff0000" },
  });
  fireEvent.change(screen.getByLabelText("Slant (degrees)"), {
    target: { value: "10" },
  });
  const first = document.querySelector(".ink text");
  expect(first).toHaveAttribute("font-size", "6");
  expect(first).toHaveAttribute("fill", "#ff0000");
  expect(first?.getAttribute("transform")).toContain("skewX(-10)");
});

test("local template saves reload settings and Equation Mode never resumes enabled", async () => {
  await openApp();
  fireEvent.change(screen.getByLabelText("Left margin (mm)"), {
    target: { value: "28" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save template" }));
  await waitFor(() =>
    expect(screen.getByRole("status")).toHaveTextContent(
      "Template saved locally",
    ),
  );
  expect(
    (await readStored<Array<{ name: string }>>("templates"))?.[0].name,
  ).toBe("My paper");
  fireEvent.click(screen.getByRole("tab", { name: /Writing Editor/ }));
  fireEvent.click(screen.getByLabelText("Equation Mode"));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 450));
  });
  cleanup();
  await openApp();
  fireEvent.click(screen.getByRole("tab", { name: /Writing Editor/ }));
  expect(screen.getByLabelText("Equation Mode")).not.toBeChecked();
});

test("export failure and invalid uploads have visible errors", async () => {
  await openApp();
  fireEvent.change(screen.getByLabelText(/Upload paper photo/), {
    target: { files: [new File(["text"], "bad.txt", { type: "text/plain" })] },
  });
  expect(screen.getByRole("status")).toHaveTextContent(
    "Choose a JPG, JPEG or PNG",
  );
  fireEvent.click(screen.getByRole("tab", { name: /Preview and Export/ }));
  fireEvent.click(
    screen.getByRole("button", { name: "Download ink-only PDF" }),
  );
  await waitFor(() =>
    expect(screen.getByRole("status")).toHaveTextContent("Backend offline"),
  );
});

test("invalid draft geometry reloads with its source text intact", async () => {
  await openApp();
  fireEvent.click(screen.getByRole("tab", { name: /Writing Editor/ }));
  fireEvent.change(screen.getByLabelText("Your text"), {
    target: { value: "This source must survive invalid settings." },
  });
  fireEvent.change(screen.getByLabelText("Writing size (mm)"), {
    target: { value: "0" },
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 450));
  });
  cleanup();
  await openApp();
  fireEvent.click(screen.getByRole("tab", { name: /Writing Editor/ }));
  expect(screen.getByLabelText("Your text")).toHaveValue(
    "This source must survive invalid settings.",
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "font size mm must be 1 to 20",
  );
});
