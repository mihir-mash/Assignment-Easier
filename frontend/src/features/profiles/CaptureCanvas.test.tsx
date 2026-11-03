import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { CaptureCanvas } from "./CaptureCanvas";
import { emptyStrokeData } from "./captureTypes";
import type { StrokeData } from "./api";

function pointer(
  target: Element,
  name: string,
  values: Record<string, unknown>,
  coalesced?: PointerEvent[],
) {
  const event = new Event(name, { bubbles: true, cancelable: true });
  const properties = {
    pointerId: 1,
    pointerType: "pen",
    clientX: 0,
    clientY: 0,
    pressure: 0.7,
    tiltX: 0,
    tiltY: 0,
    ...values,
  };
  for (const [key, value] of Object.entries(properties))
    Object.defineProperty(event, key, { configurable: true, value });
  if (coalesced)
    Object.defineProperty(event, "getCoalescedEvents", {
      value: () => coalesced,
    });
  target.dispatchEvent(event);
}

function coalescedPoint(x: number, timeStamp: number) {
  const event = new Event("pointermove");
  for (const [key, value] of Object.entries({
    pointerId: 1,
    pointerType: "pen",
    clientX: x,
    clientY: x,
    pressure: 0.4,
    tiltX: 4,
    tiltY: 5,
    timeStamp,
  }))
    Object.defineProperty(event, key, { configurable: true, value });
  return event as PointerEvent;
}

function setup(penOnly = true, paused = false) {
  const context = {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
  vi.spyOn(
    HTMLCanvasElement.prototype,
    "getBoundingClientRect",
  ).mockReturnValue({
    left: 10,
    top: 20,
    width: 300,
    height: 200,
    right: 310,
    bottom: 220,
    x: 10,
    y: 20,
    toJSON: () => ({}),
  } as DOMRect);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
  let latest: StrokeData = emptyStrokeData();
  const onChange = vi.fn((next: StrokeData) => {
    latest = next;
  });
  const view = render(
    <CaptureCanvas
      value={latest}
      captureStartedAt={performance.timeOrigin}
      penOnly={penOnly}
      paused={paused}
      onChange={onChange}
    />,
  );
  return {
    ...view,
    canvas: screen.getByRole("img", { name: "Handwriting capture canvas" }),
    onChange,
    getLatest: () => latest,
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test("captures pen points, coalesced events, pressure, tilt, and one down/up pair", () => {
  const { canvas, getLatest } = setup();
  pointer(canvas, "pointerdown", { clientX: 40, clientY: 50, timeStamp: 10 });
  pointer(
    canvas,
    "pointermove",
    { clientX: 290, clientY: 200, timeStamp: 30 },
    [coalescedPoint(100, 20), coalescedPoint(160, 25)],
  );
  pointer(canvas, "pointerup", { clientX: 280, clientY: 180, timeStamp: 40 });
  const raw = getLatest();
  expect(raw.strokes).toHaveLength(1);
  expect(raw.strokes[0].points.map((point) => point.x)).toEqual([
    0.1, 0.3, 0.5, 0.9,
  ]);
  expect(raw.strokes[0].points[1].pressure).toBe(0.4);
  expect(raw.strokes[0].points[1].tiltX).toBe(4);
  expect(raw.events.map((event) => event.type)).toEqual(["pen_down", "pen_up"]);
  expect(raw.canvas).toEqual({ width_px: 300, height_px: 200 });
});

test("allows mouse testing, ignores touch in Pen only mode, and accepts touch when disabled", () => {
  const view = setup(true);
  pointer(view.canvas, "pointerdown", {
    pointerType: "touch",
    clientX: 30,
    clientY: 40,
  });
  expect(view.getLatest().strokes).toHaveLength(0);
  pointer(view.canvas, "pointerdown", {
    pointerType: "mouse",
    clientX: 40,
    clientY: 50,
  });
  pointer(view.canvas, "pointerup", {
    pointerType: "mouse",
    clientX: 70,
    clientY: 80,
  });
  expect(view.getLatest().strokes[0].pointer_type).toBe("mouse");
  expect(view.getLatest().strokes[0].points[0].pressure).toBeNull();

  view.rerender(
    <CaptureCanvas
      value={view.getLatest()}
      captureStartedAt={performance.timeOrigin}
      penOnly={false}
      paused={false}
      onChange={view.onChange}
    />,
  );
  pointer(view.canvas, "pointerdown", {
    pointerType: "touch",
    pointerId: 2,
    clientX: 40,
    clientY: 50,
  });
  pointer(view.canvas, "pointerup", {
    pointerType: "touch",
    pointerId: 2,
    clientX: 80,
    clientY: 100,
  });
  expect(view.getLatest().strokes[1].pointer_type).toBe("touch");
});

test("pointer cancel preserves and marks an interrupted stroke; paused canvas ignores input", () => {
  const view = setup(false);
  pointer(view.canvas, "pointerdown", { clientX: 40, clientY: 50 });
  pointer(view.canvas, "pointermove", {
    clientX: 90,
    clientY: 80,
    timeStamp: 20,
  });
  pointer(view.canvas, "pointercancel", {
    clientX: 90,
    clientY: 80,
    timeStamp: 25,
  });
  expect(view.getLatest().strokes[0].interrupted).toBe(true);
  expect(view.getLatest().strokes[0].points).toHaveLength(2);
  expect(view.getLatest().events.at(-1)?.type).toBe("pointer_cancel");

  view.rerender(
    <CaptureCanvas
      value={view.getLatest()}
      captureStartedAt={performance.timeOrigin}
      penOnly={false}
      paused
      onChange={view.onChange}
    />,
  );
  pointer(view.canvas, "pointerdown", {
    clientX: 100,
    clientY: 100,
    pointerId: 3,
  });
  expect(view.getLatest().strokes).toHaveLength(1);
});
