from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.paper.templates import DATABASE
from app.profiles_processing import normalize_stroke_sample
from app.storage import asset_directory, migrate

router = APIRouter(prefix="/api/v1/profiles", tags=["handwriting profiles"])
ProfileStatus = Literal["Draft", "Collecting Samples", "Processing", "Needs Review", "Collection Complete"]
SourceType = Literal["uploaded_image", "stylus"]
LabelType = Literal["character", "combination", "word", "sentence", "unlabelled"]
SampleContext = Literal["isolated", "in_word", "in_sentence"]
LabelAlignment = Literal["exact", "unaligned", "manual", "unknown"]


class ProfileCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=100)
    status: ProfileStatus = "Draft"
    sample_sources: list[SourceType] = Field(default_factory=list)
    processing_status: str = Field(default="not_started", max_length=40)
    metadata: dict[str, Any] = Field(default_factory=dict)
    data_format_version: int = Field(default=1, ge=1)


class ProfileRename(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=100)


class StrokePoint(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    timestamp: float = Field(ge=0)
    pressure: float | None = Field(default=None, ge=0, le=1)
    tiltX: float | None = Field(default=None, ge=-90, le=90)
    tiltY: float | None = Field(default=None, ge=-90, le=90)
    pointer_type: Literal["pen", "mouse", "touch", "unknown"] = "unknown"


class Stroke(BaseModel):
    model_config = ConfigDict(extra="forbid")
    points: list[StrokePoint] = Field(min_length=1, max_length=10000)
    pointer_type: Literal["pen", "mouse", "touch", "unknown"] = "unknown"
    start_timestamp: float | None = Field(default=None, ge=0)
    end_timestamp: float | None = Field(default=None, ge=0)
    interrupted: bool = False


class StrokeEvent(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    type: Literal[
        "pen_down",
        "pen_up",
        "pointer_cancel",
        "lost_pointer_capture",
        "session_interrupted",
    ]
    timestamp: float = Field(ge=0)
    stroke_index: int | None = Field(default=None, ge=0)


class StrokeData(BaseModel):
    model_config = ConfigDict(extra="forbid")
    format_version: int = Field(ge=1)
    strokes: list[Stroke] = Field(max_length=2000)
    events: list[StrokeEvent] = Field(default_factory=list, max_length=20000)
    pointer_type: Literal["pen", "mouse", "touch", "unknown"]
    pen_metadata: dict[str, Any] = Field(default_factory=dict)
    canvas: dict[str, float]  # width_px and height_px at capture time

    def validate_canvas(self) -> None:
        if set(self.canvas) != {"width_px", "height_px"} or any(not 1 <= v <= 20000 for v in self.canvas.values()):
            raise ValueError("Canvas must contain positive width_px and height_px values.")


class NormalizeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    stroke_data: StrokeData


def _store_stylus_data(stroke_data: StrokeData) -> tuple[str, str, dict[str, Any]]:
    directory = asset_directory(DATABASE)
    raw_reference = str(uuid.uuid4())
    raw_payload = stroke_data.model_dump_json(exclude_unset=True)
    raw_path = directory / f"{raw_reference}.stroke-v{stroke_data.format_version}.json"
    with raw_path.open("x", encoding="utf-8") as raw_file:
        raw_file.write(raw_payload)
    normalized = normalize_stroke_sample(json.loads(raw_payload))
    processed_reference = str(uuid.uuid4())
    processed_path = directory / f"{processed_reference}.normalized-v1.json"
    with processed_path.open("x", encoding="utf-8") as processed_file:
        json.dump(normalized, processed_file, separators=(",", ":"))
    return raw_reference, processed_reference, normalized


@router.post("/normalize")
def normalize_sample(request: NormalizeRequest) -> dict[str, Any]:
    try:
        request.stroke_data.validate_canvas()
        return normalize_stroke_sample(
            json.loads(request.stroke_data.model_dump_json(exclude_unset=True))
        )
    except ValueError as error:
        raise HTTPException(422, str(error)) from error


class SampleCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source_type: SourceType
    original_asset_ref: str | None = None
    processed_asset_ref: str | None = None
    prompt_text: str | None = Field(default=None, max_length=20000)
    label_type: LabelType = "unlabelled"
    label_text: str | None = Field(default=None, max_length=20000)
    context: SampleContext = "isolated"
    repetition_number: int | None = Field(default=None, ge=1, le=10000)
    dimensions: dict[str, int] = Field(default_factory=dict)
    processing_status: str = Field(default="not_started", max_length=40)
    quality_indicators: dict[str, Any] = Field(default_factory=dict)
    label_alignment: LabelAlignment = "unknown"
    stroke_data: StrokeData | None = None

    def validate_refs(self) -> None:
        for ref in (self.original_asset_ref, self.processed_asset_ref):
            if ref is not None:
                try:
                    uuid.UUID(ref)
                except ValueError as error:
                    raise ValueError("Asset references must be generated opaque IDs.") from error
        if any(not key.endswith("_px") or not isinstance(value, int) or not 1 <= value <= 100000 for key, value in self.dimensions.items()):
            raise ValueError("Dimensions must use positive pixel values with *_px keys.")
        if self.source_type == "stylus" and self.stroke_data is None:
            raise ValueError("Stylus samples require stroke data.")
        if self.stroke_data:
            self.stroke_data.validate_canvas()


def _connect() -> sqlite3.Connection:
    migrate(DATABASE)
    db = sqlite3.connect(DATABASE)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    return db


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _profile(row: sqlite3.Row) -> dict[str, Any]:
    item = dict(row)
    for key in ("sample_sources", "metadata"):
        item[key] = json.loads(item[key])
    return item


def _sample(row: sqlite3.Row) -> dict[str, Any]:
    item = dict(row)
    for key in ("dimensions", "quality_indicators"):
        item[key] = json.loads(item[key])
    item.pop("stroke_asset_ref", None)
    return item


def _find_profile(db: sqlite3.Connection, profile_id: str) -> sqlite3.Row:
    row = db.execute("SELECT * FROM handwriting_profiles WHERE id=?", (profile_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "Handwriting profile was not found.")
    return row


@router.post("", status_code=201)
def create_profile(request: ProfileCreate) -> dict[str, Any]:
    name = request.name.strip()
    if not name:
        raise HTTPException(422, "Profile name cannot be blank.")
    profile_id, now = str(uuid.uuid4()), _now()
    with _connect() as db:
        db.execute("INSERT INTO handwriting_profiles VALUES(?,?,?,?,?,?,?,?,?,?)", (profile_id, name, now, now, request.status, json.dumps(sorted(set(request.sample_sources))), 0, request.processing_status, json.dumps(request.metadata), request.data_format_version))
        return _profile(db.execute("SELECT * FROM handwriting_profiles WHERE id=?", (profile_id,)).fetchone())


@router.get("")
def list_profiles() -> list[dict[str, Any]]:
    with _connect() as db:
        return [_profile(row) for row in db.execute("SELECT * FROM handwriting_profiles ORDER BY created_at")]


@router.get("/{profile_id}")
def get_profile(profile_id: str) -> dict[str, Any]:
    with _connect() as db:
        return _profile(_find_profile(db, profile_id))


@router.put("/{profile_id}")
def rename_profile(profile_id: str, request: ProfileRename) -> dict[str, Any]:
    name = request.name.strip()
    if not name:
        raise HTTPException(422, "Profile name cannot be blank.")
    with _connect() as db:
        _find_profile(db, profile_id)
        db.execute("UPDATE handwriting_profiles SET name=?,updated_at=? WHERE id=?", (name, _now(), profile_id))
        return _profile(_find_profile(db, profile_id))


@router.delete("/{profile_id}")
def delete_profile(profile_id: str, confirm: bool = Query(default=False)) -> dict[str, str]:
    if not confirm:
        raise HTTPException(409, "Set confirm=true to delete this profile and its sample records.")
    with _connect() as db:
        _find_profile(db, profile_id)
        db.execute("DELETE FROM handwriting_samples WHERE profile_id=?", (profile_id,))
        db.execute("DELETE FROM handwriting_profiles WHERE id=?", (profile_id,))
    return {"id": profile_id, "status": "deleted"}


@router.post("/{profile_id}/samples", status_code=201)
def create_sample(profile_id: str, request: SampleCreate) -> dict[str, Any]:
    try:
        request.validate_refs()
    except (ValueError, ValidationError) as error:
        raise HTTPException(422, str(error)) from error
    sample_id, now = str(uuid.uuid4()), _now()
    stroke_ref = None
    processed_ref = request.processed_asset_ref
    sample_quality = request.quality_indicators
    processing_status = request.processing_status
    normalization = None
    with _connect() as db:
        _find_profile(db, profile_id)
        if request.stroke_data:
            if len(request.stroke_data.model_dump_json(exclude_unset=True).encode()) > 8_000_000:
                raise HTTPException(413, "Stroke data exceeds the 8 MB limit.")
            stroke_ref, processed_ref, normalization = _store_stylus_data(request.stroke_data)
            sample_quality = {
                **request.quality_indicators,
                "stylus_normalization": {
                    "bounding_box": normalization["bounding_box"],
                    "stroke_count": normalization["stroke_count"],
                    "duration_ms": normalization["duration_ms"],
                    "has_pressure": normalization["has_pressure"],
                    "has_timing": normalization["has_timing"],
                    "quality": normalization["quality"],
                },
            }
            processing_status = "needs_review" if normalization["quality"]["problems"] else "processed"
        values = (sample_id, profile_id, request.source_type, request.original_asset_ref, processed_ref, request.prompt_text, request.label_type, request.label_text, request.context, request.repetition_number, json.dumps(request.dimensions), processing_status, json.dumps(sample_quality), now, request.label_alignment, stroke_ref)
        db.execute("INSERT INTO handwriting_samples VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", values)
        db.execute("UPDATE handwriting_profiles SET total_sample_count=total_sample_count+1,updated_at=? WHERE id=?", (now, profile_id))
        result = _sample(db.execute("SELECT * FROM handwriting_samples WHERE id=?", (sample_id,)).fetchone())
        if normalization is not None:
            result["normalization"] = normalization
        return result


@router.get("/{profile_id}/samples")
def list_samples(profile_id: str) -> list[dict[str, Any]]:
    with _connect() as db:
        _find_profile(db, profile_id)
        return [_sample(row) for row in db.execute("SELECT * FROM handwriting_samples WHERE profile_id=? ORDER BY created_at", (profile_id,))]


@router.get("/{profile_id}/samples/{sample_id}")
def get_sample(profile_id: str, sample_id: str) -> dict[str, Any]:
    with _connect() as db:
        _find_profile(db, profile_id)
        row = db.execute("SELECT * FROM handwriting_samples WHERE id=? AND profile_id=?", (sample_id, profile_id)).fetchone()
        if row is None:
            raise HTTPException(404, "Handwriting sample was not found.")
        result = _sample(row)
        ref = row["stroke_asset_ref"]
        if ref:
            directory = asset_directory(DATABASE)
            raw_paths = sorted(directory.glob(f"{ref}.stroke-v*.json"), reverse=True)
            if raw_paths:
                result["stroke_data"] = json.loads(raw_paths[0].read_text(encoding="utf-8"))
        processed_ref = row["processed_asset_ref"]
        if row["source_type"] == "stylus" and processed_ref:
            processed_path = asset_directory(DATABASE) / f"{processed_ref}.normalized-v1.json"
            if processed_path.is_file():
                result["normalized_stroke_data"] = json.loads(processed_path.read_text(encoding="utf-8"))
        return result


@router.put("/{profile_id}/samples/{sample_id}")
def update_sample(profile_id: str, sample_id: str, request: SampleCreate) -> dict[str, Any]:
    try:
        request.validate_refs()
    except (ValueError, ValidationError) as error:
        raise HTTPException(422, str(error)) from error
    with _connect() as db:
        _find_profile(db, profile_id)
        existing = db.execute("SELECT * FROM handwriting_samples WHERE id=? AND profile_id=?", (sample_id, profile_id)).fetchone()
        if existing is None:
            raise HTTPException(404, "Handwriting sample was not found.")
        # Keep raw stroke files immutable: edits that supply strokes create a new file.
        stroke_ref = existing["stroke_asset_ref"]
        processed_ref = request.processed_asset_ref
        sample_quality = request.quality_indicators
        processing_status = request.processing_status
        if request.stroke_data:
            if len(request.stroke_data.model_dump_json(exclude_unset=True).encode()) > 8_000_000:
                raise HTTPException(413, "Stroke data exceeds the 8 MB limit.")
            stroke_ref, processed_ref, normalization = _store_stylus_data(request.stroke_data)
            sample_quality = {
                **request.quality_indicators,
                "stylus_normalization": {
                    "bounding_box": normalization["bounding_box"],
                    "stroke_count": normalization["stroke_count"],
                    "duration_ms": normalization["duration_ms"],
                    "has_pressure": normalization["has_pressure"],
                    "has_timing": normalization["has_timing"],
                    "quality": normalization["quality"],
                },
            }
            processing_status = "needs_review" if normalization["quality"]["problems"] else "processed"
        values = (request.source_type, request.original_asset_ref, processed_ref, request.prompt_text, request.label_type, request.label_text, request.context, request.repetition_number, json.dumps(request.dimensions), processing_status, json.dumps(sample_quality), request.label_alignment, stroke_ref, sample_id, profile_id)
        db.execute("UPDATE handwriting_samples SET source_type=?,original_asset_ref=?,processed_asset_ref=?,prompt_text=?,label_type=?,label_text=?,context=?,repetition_number=?,dimensions=?,processing_status=?,quality_indicators=?,label_alignment=?,stroke_asset_ref=? WHERE id=? AND profile_id=?", values)
        db.execute("UPDATE handwriting_profiles SET updated_at=? WHERE id=?", (_now(), profile_id))
        return _sample(db.execute("SELECT * FROM handwriting_samples WHERE id=?", (sample_id,)).fetchone())


@router.delete("/{profile_id}/samples/{sample_id}")
def delete_sample(profile_id: str, sample_id: str, confirm: bool = Query(default=False)) -> dict[str, str]:
    if not confirm:
        raise HTTPException(409, "Set confirm=true to delete this sample record.")
    with _connect() as db:
        _find_profile(db, profile_id)
        cursor = db.execute("DELETE FROM handwriting_samples WHERE id=? AND profile_id=?", (sample_id, profile_id))
        if cursor.rowcount == 0:
            raise HTTPException(404, "Handwriting sample was not found.")
        db.execute("UPDATE handwriting_profiles SET total_sample_count=total_sample_count-1,updated_at=? WHERE id=?", (_now(), profile_id))
    # Raw files are retained; collection UI may later offer an explicit retention flow.
    return {"id": sample_id, "status": "deleted"}
