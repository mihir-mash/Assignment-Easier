import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { PointerType, StrokeData, StrokeEvent, StrokePoint } from "./api";

export type CaptureCanvasHandle = {
  interrupt: (reason?: "session_interrupted") => void;
};
type ActiveStroke = { pointerId: number; strokeIndex: number };

export const CaptureCanvas = forwardRef<
  CaptureCanvasHandle,
  {
    value: StrokeData;
    captureStartedAt: number;
    penOnly: boolean;
    paused: boolean;
    onChange: (value: StrokeData) => void;
  }
>(function CaptureCanvas(
  { value, captureStartedAt, penOnly, paused, onChange },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef<ActiveStroke | null>(null);
  const rawRef = useRef(value);
  rawRef.current = value;

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const width = Math.max(1, bounds.width);
    const height = Math.max(1, bounds.height);
    const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
    const expectedWidth = Math.round(width * pixelRatio);
    const expectedHeight = Math.round(height * pixelRatio);
    if (canvas.width !== expectedWidth || canvas.height !== expectedHeight) {
      canvas.width = expectedWidth;
      canvas.height = expectedHeight;
    }
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.strokeStyle = "#244c37";
    context.lineWidth = 2.6;
    context.lineCap = "round";
    context.lineJoin = "round";
    for (const stroke of rawRef.current.strokes) {
      if (!stroke.points.length) continue;
      context.beginPath();
      context.moveTo(stroke.points[0].x * width, stroke.points[0].y * height);
      for (const point of stroke.points.slice(1))
        context.lineTo(point.x * width, point.y * height);
      context.stroke();
    }
  }, []);

  useImperativeHandle(ref, () => ({
    interrupt: (reason = "session_interrupted") => {
      const active = activeRef.current;
      if (active) {
        finishStroke(active, reason, true);
        release(active.pointerId);
      }
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    redraw();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(redraw);
    observer?.observe(canvas);
    window.addEventListener("resize", redraw);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", redraw);
    };
  }, [redraw]);
  useEffect(() => redraw(), [redraw, value]);
  useLayoutEffect(
    () => () => {
      const active = activeRef.current;
      if (active) {
        finishStroke(active, "session_interrupted", true);
        release(active.pointerId);
      }
    },
    [],
  );

  function timeFor(event: PointerEvent): number {
    return Math.max(
      0,
      performance.timeOrigin + event.timeStamp - captureStartedAt,
    );
  }

  function pointFor(event: PointerEvent): StrokePoint {
    const bounds = canvasRef.current!.getBoundingClientRect();
    const pointerType = (event.pointerType || "unknown") as PointerType;
    return {
      x: Math.max(
        0,
        Math.min(1, (event.clientX - bounds.left) / Math.max(1, bounds.width)),
      ),
      y: Math.max(
        0,
        Math.min(1, (event.clientY - bounds.top) / Math.max(1, bounds.height)),
      ),
      timestamp: timeFor(event),
      pressure:
        pointerType !== "mouse" && Number.isFinite(event.pressure)
          ? event.pressure
          : null,
      tiltX:
        pointerType === "pen" && Number.isFinite(event.tiltX)
          ? event.tiltX
          : null,
      tiltY:
        pointerType === "pen" && Number.isFinite(event.tiltY)
          ? event.tiltY
          : null,
      pointer_type: pointerType,
    };
  }

  function update(transform: (previous: StrokeData) => StrokeData) {
    const next = transform(rawRef.current);
    rawRef.current = next;
    onChange(next);
  }

  function addPoint(event: PointerEvent, strokeIndex: number) {
    const point = pointFor(event);
    update((previous) => ({
      ...previous,
      strokes: previous.strokes.map((stroke, index) => {
        if (index !== strokeIndex) return stroke;
        const last = stroke.points[stroke.points.length - 1];
        if (
          last &&
          Math.abs(last.x - point.x) < 0.0001 &&
          Math.abs(last.y - point.y) < 0.0001
        )
          return stroke;
        return { ...stroke, points: [...stroke.points, point] };
      }),
    }));
  }

  function finishStroke(
    active: ActiveStroke,
    terminal: StrokeEvent["type"],
    interrupted: boolean,
    event?: PointerEvent,
  ) {
    if (activeRef.current?.pointerId !== active.pointerId) return;
    if (event && terminal === "pen_up") addPoint(event, active.strokeIndex);
    const timestamp = event
      ? timeFor(event)
      : Math.max(
          0,
          performance.timeOrigin + performance.now() - captureStartedAt,
        );
    update((previous) => ({
      ...previous,
      strokes: previous.strokes.map((stroke, index) =>
        index === active.strokeIndex
          ? { ...stroke, end_timestamp: timestamp, interrupted }
          : stroke,
      ),
      events: [
        ...previous.events,
        { type: terminal, stroke_index: active.strokeIndex, timestamp },
      ],
    }));
    activeRef.current = null;
  }

  function release(pointerId: number) {
    try {
      if (canvasRef.current?.hasPointerCapture(pointerId))
        canvasRef.current.releasePointerCapture(pointerId);
    } catch {
      // The browser can release capture before this control runs.
    }
  }

  function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (paused || activeRef.current) return;
    const pointerType = (event.pointerType || "unknown") as PointerType;
    if (penOnly && pointerType === "touch") {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    const point = pointFor(event.nativeEvent);
    const strokeIndex = rawRef.current.strokes.length;
    const bounds = event.currentTarget.getBoundingClientRect();
    const active = { pointerId: event.pointerId, strokeIndex };
    activeRef.current = active;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic test events do not have a browser pointer to capture.
    }
    update((previous) => ({
      ...previous,
      pointer_type:
        previous.strokes.length === 0
          ? pointerType
          : previous.pointer_type === pointerType
            ? pointerType
            : "unknown",
      canvas:
        previous.strokes.length === 0
          ? {
              width_px: Math.max(1, Math.round(bounds.width)),
              height_px: Math.max(1, Math.round(bounds.height)),
            }
          : previous.canvas,
      strokes: [
        ...previous.strokes,
        {
          points: [point],
          pointer_type: pointerType,
          start_timestamp: point.timestamp,
          end_timestamp: null,
          interrupted: false,
        },
      ],
      events: [
        ...previous.events,
        {
          type: "pen_down",
          stroke_index: strokeIndex,
          timestamp: point.timestamp,
        },
      ],
    }));
  }

  function onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const active = activeRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    event.preventDefault();
    let coalesced: PointerEvent[] = [];
    try {
      coalesced = event.nativeEvent.getCoalescedEvents?.() ?? [];
    } catch {
      coalesced = [];
    }
    const incoming = coalesced.length ? coalesced : [event.nativeEvent];
    const points = incoming.map(pointFor);
    update((previous) => ({
      ...previous,
      strokes: previous.strokes.map((stroke, index) => {
        if (index !== active.strokeIndex) return stroke;
        const nextPoints = [...stroke.points];
        for (const point of points) {
          const last = nextPoints[nextPoints.length - 1];
          if (
            last &&
            Math.abs(last.x - point.x) < 0.0001 &&
            Math.abs(last.y - point.y) < 0.0001
          )
            continue;
          nextPoints.push(point);
        }
        return { ...stroke, points: nextPoints };
      }),
    }));
  }

  function onPointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    const active = activeRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    event.preventDefault();
    finishStroke(active, "pen_up", false, event.nativeEvent);
    release(event.pointerId);
  }

  function onPointerCancel(event: ReactPointerEvent<HTMLCanvasElement>) {
    const active = activeRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    event.preventDefault();
    finishStroke(active, "pointer_cancel", true, event.nativeEvent);
  }

  function onLostPointerCapture(event: ReactPointerEvent<HTMLCanvasElement>) {
    const active = activeRef.current;
    if (active?.pointerId === event.pointerId)
      finishStroke(active, "lost_pointer_capture", true, event.nativeEvent);
  }

  return (
    <canvas
      ref={canvasRef}
      className={`capture-canvas${paused ? " is-paused" : ""}`}
      aria-label="Handwriting capture canvas"
      role="img"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onLostPointerCapture={onLostPointerCapture}
    />
  );
});
