import json
import sqlite3
import uuid
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from app.api.models import LayoutRequest

router = APIRouter(prefix="/api/v1/paper/templates", tags=["paper templates"])
DATABASE = Path(__file__).resolve().parents[2] / "data" / "paper-templates.sqlite3"


class TemplateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=80)
    template: dict[str, Any]

    def validate_settings(self) -> None:
        settings = self.template.get("settings")
        if not isinstance(settings, dict):
            raise HTTPException(422, "A paper template must include its physical dimensions and writing settings.")
        try:
            LayoutRequest.model_validate(settings)
        except ValidationError as error:
            raise HTTPException(422, "Paper template contains invalid physical or writing geometry.") from error


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    DATABASE.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DATABASE)
    db.execute("CREATE TABLE IF NOT EXISTS paper_templates (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, payload TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)")
    try:
        yield db
        db.commit()
    finally:
        db.close()


@router.get("")
def list_templates() -> list[dict[str, str]]:
    with connect() as db:
        return [{"id": row[0], "name": row[1], "updated_at": row[2]} for row in db.execute("SELECT id,name,updated_at FROM paper_templates ORDER BY name")]


@router.post("", status_code=201)
def save_template(request: TemplateRequest) -> dict[str, str]:
    request.validate_settings()
    name = request.name.strip()
    if not name:
        raise HTTPException(422, "Template name cannot be blank.")
    if len(json.dumps(request.template)) > 16_000_000:
        raise HTTPException(413, "Template exceeds the 16 MB storage limit.")
    template_id = str(uuid.uuid4())
    try:
        with connect() as db:
            db.execute("INSERT INTO paper_templates(id,name,payload) VALUES(?,?,?)", (template_id, name, json.dumps(request.template, separators=(",", ":"))))
    except sqlite3.IntegrityError as error:
        raise HTTPException(409, "A paper template with this name already exists.") from error
    return {"id": template_id, "name": name}


@router.get("/{template_id}")
def load_template(template_id: str) -> dict[str, Any]:
    with connect() as db:
        row = db.execute("SELECT id,name,payload FROM paper_templates WHERE id=?", (template_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Paper template was not found.")
    return {"id": row[0], "name": row[1], "template": json.loads(row[2])}


@router.put("/{template_id}")
def update_template(template_id: str, request: TemplateRequest) -> dict[str, str]:
    request.validate_settings()
    name = request.name.strip()
    if not name:
        raise HTTPException(422, "Template name cannot be blank.")
    if len(json.dumps(request.template)) > 16_000_000:
        raise HTTPException(413, "Template exceeds the 16 MB storage limit.")
    try:
        with connect() as db:
            cursor = db.execute("UPDATE paper_templates SET name=?,payload=?,updated_at=CURRENT_TIMESTAMP WHERE id=?", (name, json.dumps(request.template, separators=(",", ":")), template_id))
    except sqlite3.IntegrityError as error:
        raise HTTPException(409, "A paper template with this name already exists.") from error
    if cursor.rowcount == 0:
        raise HTTPException(404, "Paper template was not found.")
    return {"id": template_id, "name": name}
