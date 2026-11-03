from copy import deepcopy

from app.profiles_processing import normalize_stroke_sample


def sample(strokes=None, events=None):
    return {
        "format_version": 2,
        "pointer_type": "pen",
        "canvas": {"width_px": 400, "height_px": 200},
        "strokes": strokes
        if strokes is not None
        else [
            {
                "pointer_type": "pen",
                "start_timestamp": 10,
                "end_timestamp": 110,
                "interrupted": False,
                "points": [
                    {"x": 0.2, "y": 0.25, "timestamp": 10, "pointer_type": "pen"},
                    {"x": 0.6, "y": 0.75, "timestamp": 110, "pointer_type": "pen", "pressure": 0.8},
                ],
            }
        ],
        "events": events
        if events is not None
        else [
            {"type": "pen_down", "stroke_index": 0, "timestamp": 10},
            {"type": "pen_up", "stroke_index": 0, "timestamp": 110},
        ],
    }


def test_normalization_is_repeatable_non_destructive_and_reports_metrics():
    raw = sample()
    untouched = deepcopy(raw)
    first = normalize_stroke_sample(raw)
    second = normalize_stroke_sample(raw)

    assert raw == untouched
    assert first == second
    assert first["bounding_box"] == {"min_x": 0.2, "min_y": 0.25, "max_x": 0.6, "max_y": 0.75}
    assert first["stroke_count"] == 1
    assert first["duration_ms"] == 100
    assert first["has_pressure"] is True
    assert first["has_timing"] is True
    assert first["strokes"][0]["points"][0]["x"] == 0
    assert first["strokes"][0]["points"][1]["y"] == 1
    assert first["quality"]["can_keep"] is True
    assert first["quality"]["problems"] == []


def test_missing_pressure_tilt_are_valid_and_canvas_size_does_not_change_normalized_shape():
    raw = sample(
        strokes=[
            {
                "points": [
                    {"x": 0.1, "y": 0.2, "timestamp": 1, "pointer_type": "pen"},
                    {"x": 0.8, "y": 0.9, "timestamp": 50, "pointer_type": "pen"},
                ]
            }
        ],
        events=[
            {"type": "pen_down", "stroke_index": 0, "timestamp": 1},
            {"type": "pen_up", "stroke_index": 0, "timestamp": 50},
        ],
    )
    before = normalize_stroke_sample(raw)
    resized = deepcopy(raw)
    resized["canvas"] = {"width_px": 800, "height_px": 600}
    after = normalize_stroke_sample(resized)

    assert before["strokes"][0]["points"] == after["strokes"][0]["points"]
    assert before["has_pressure"] is False
    assert after["canvas"] == {"width_px": 800, "height_px": 600}


def test_empty_small_short_interrupted_and_invalid_sequences_are_explained_not_rejected():
    empty = normalize_stroke_sample(sample(strokes=[], events=[]))
    assert "empty_sample" in {problem["code"] for problem in empty["quality"]["problems"]}
    assert empty["quality"]["can_keep"] is True

    interrupted_stroke = {
        "pointer_type": "pen",
        "start_timestamp": 1,
        "end_timestamp": 2,
        "interrupted": True,
        "points": [
            {"x": 0.01, "y": 0.01, "timestamp": 1, "pointer_type": "pen"},
            {"x": 0.015, "y": 0.015, "timestamp": 2, "pointer_type": "pen"},
        ],
    }
    result = normalize_stroke_sample(
        sample(
            strokes=[interrupted_stroke],
            events=[
                {"type": "pen_down", "stroke_index": 0, "timestamp": 1},
                {"type": "session_interrupted", "stroke_index": 0, "timestamp": 2},
            ],
        )
    )
    codes = {problem["code"] for problem in result["quality"]["problems"]}
    assert {"very_small", "short_strokes", "interrupted_strokes"} <= codes
    assert result["quality"]["can_keep"] is True

    invalid = normalize_stroke_sample(
        sample(events=[{"type": "pen_up", "stroke_index": 0, "timestamp": 20}])
    )
    assert "invalid_sequence" in {problem["code"] for problem in invalid["quality"]["problems"]}
