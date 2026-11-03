"""Deterministic, non-destructive stylus normalization and quality checks."""

from __future__ import annotations

from copy import deepcopy
from math import isfinite
from typing import Any


def normalize_stroke_sample(raw_sample: dict[str, Any]) -> dict[str, Any]:
    """Return a bbox-normalized copy and quality notes without changing raw input."""
    raw_copy = deepcopy(raw_sample)
    strokes = raw_copy.get("strokes", [])
    points = [point for stroke in strokes for point in stroke.get("points", [])]
    problems: list[dict[str, str]] = []

    def add_problem(code: str, message: str) -> None:
        if not any(problem["code"] == code for problem in problems):
            problems.append({"code": code, "message": message})

    if not points:
        add_problem("empty_sample", "No pen strokes were captured. Write the prompt before saving.")
        bounds = {"min_x": 0.0, "min_y": 0.0, "max_x": 0.0, "max_y": 0.0}
        width = height = 0.0
    else:
        x_values = [float(point["x"]) for point in points]
        y_values = [float(point["y"]) for point in points]
        bounds = {
            "min_x": min(x_values),
            "min_y": min(y_values),
            "max_x": max(x_values),
            "max_y": max(y_values),
        }
        width = bounds["max_x"] - bounds["min_x"]
        height = bounds["max_y"] - bounds["min_y"]
        if width < 0.02 or height < 0.02:
            add_problem("very_small", "The writing covers a small area. Try using more of the canvas.")

    normalized_strokes: list[dict[str, Any]] = []
    interrupted_count = 0
    short_count = 0
    for stroke in strokes:
        stroke_points = stroke.get("points", [])
        is_interrupted = bool(stroke.get("interrupted", False))
        interrupted_count += int(is_interrupted)
        times = [float(point["timestamp"]) for point in stroke_points]
        duration = max(times) - min(times) if times else 0.0
        short_count += int(len(stroke_points) < 2 or duration < 40.0)
        normalized_points = []
        for point in stroke_points:
            normalized_points.append(
                {
                    **point,
                    "x": 0.5 if width == 0 else (float(point["x"]) - bounds["min_x"]) / width,
                    "y": 0.5 if height == 0 else (float(point["y"]) - bounds["min_y"]) / height,
                }
            )
        normalized_strokes.append(
            {
                "pointer_type": stroke.get("pointer_type", "unknown"),
                "start_timestamp": stroke.get("start_timestamp", times[0] if times else None),
                "end_timestamp": stroke.get("end_timestamp", times[-1] if times else None),
                "interrupted": is_interrupted,
                "points": normalized_points,
            }
        )

    if short_count:
        add_problem("short_strokes", "One or more strokes were very short. You can keep this sample or repeat it.")
    if interrupted_count:
        add_problem("interrupted_strokes", "A stroke was interrupted. You can keep this sample or repeat it.")

    events = raw_copy.get("events", [])
    has_indexed_events = bool(events) and all("stroke_index" in event for event in events)
    if strokes and has_indexed_events:
        for stroke_index, stroke in enumerate(strokes):
            stroke_events = [event["type"] for event in events if event.get("stroke_index") == stroke_index]
            expected_terminal = (
                {"pointer_cancel", "lost_pointer_capture", "session_interrupted"}
                if stroke.get("interrupted", False)
                else {"pen_up"}
            )
            if stroke_events.count("pen_down") != 1 or sum(event in expected_terminal for event in stroke_events) != 1:
                add_problem("invalid_sequence", "A stroke start or end event is missing or out of order. Keep it or repeat the sample.")
                break
            start_position = stroke_events.index("pen_down")
            terminal_position = next(index for index, event in enumerate(stroke_events) if event in expected_terminal)
            if terminal_position <= start_position:
                add_problem("invalid_sequence", "A stroke start or end event is missing or out of order. Keep it or repeat the sample.")
                break
    elif strokes and int(raw_copy.get("format_version", 1)) >= 2:
        add_problem("invalid_sequence", "Stroke boundary events are missing. Keep it or repeat the sample.")

    timestamps = [float(point["timestamp"]) for point in points]
    timing_exists = len(set(timestamps)) > 1 and all(isfinite(value) for value in timestamps)
    pressure_exists = any(point.get("pressure") is not None for point in points)
    duration_ms = max(timestamps) - min(timestamps) if timestamps else 0.0
    return {
        "format_version": 1,
        "source_format_version": int(raw_copy.get("format_version", 1)),
        "canvas": raw_copy.get("canvas", {}),
        "bounding_box": bounds,
        "stroke_count": len(strokes),
        "duration_ms": duration_ms,
        "has_pressure": pressure_exists,
        "has_timing": timing_exists,
        "interrupted_stroke_count": interrupted_count,
        "strokes": normalized_strokes,
        "quality": {"problems": problems, "can_keep": True},
    }
