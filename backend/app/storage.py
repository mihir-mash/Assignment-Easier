"""Local SQLite migrations and generated asset storage for InkMatch."""

from __future__ import annotations

import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path


MIGRATION_1_STATEMENTS = (
    """CREATE TABLE IF NOT EXISTS paper_templates (
        id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, payload TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )""",
    """CREATE TABLE handwriting_profiles (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL, status TEXT NOT NULL,
        sample_sources TEXT NOT NULL, total_sample_count INTEGER NOT NULL DEFAULT 0,
        processing_status TEXT NOT NULL, metadata TEXT NOT NULL,
        data_format_version INTEGER NOT NULL
    )""",
    """CREATE TABLE handwriting_samples (
        id TEXT PRIMARY KEY, profile_id TEXT NOT NULL REFERENCES handwriting_profiles(id),
        source_type TEXT NOT NULL, original_asset_ref TEXT, processed_asset_ref TEXT,
        prompt_text TEXT, label_type TEXT NOT NULL, label_text TEXT,
        context TEXT NOT NULL, repetition_number INTEGER,
        dimensions TEXT NOT NULL, processing_status TEXT NOT NULL,
        quality_indicators TEXT NOT NULL, created_at TEXT NOT NULL,
        label_alignment TEXT NOT NULL, stroke_asset_ref TEXT
    )""",
    "CREATE INDEX handwriting_samples_profile_idx ON handwriting_samples(profile_id)",
)


def _migration_1(db: sqlite3.Connection) -> None:
    for statement in MIGRATION_1_STATEMENTS:
        db.execute(statement)


def backup_before_migration(database: Path) -> Path | None:
    if not database.exists():
        return None
    with sqlite3.connect(database) as source:
        version = source.execute("PRAGMA user_version").fetchone()[0]
        if version >= 1:
            return None
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
        backup = database.with_name(f"{database.stem}.backup-{stamp}{database.suffix}")
        with sqlite3.connect(backup) as target:
            source.backup(target)
        return backup


def migrate(database: Path) -> None:
    database.parent.mkdir(parents=True, exist_ok=True)
    database_existed = database.exists()
    db = sqlite3.connect(database, isolation_level=None)
    try:
        version = db.execute("PRAGMA user_version").fetchone()[0]
        if version >= 1:
            return
        if database_existed:
            backup_before_migration(database)
        db.execute("BEGIN IMMEDIATE")
        try:
            # Recheck after taking the write lock in case another process migrated.
            version = db.execute("PRAGMA user_version").fetchone()[0]
            if version < 1:
                _migration_1(db)
                db.execute("PRAGMA user_version = 1")
            db.commit()
        except BaseException:
            if db.in_transaction:
                db.rollback()
            raise
    finally:
        db.close()


def asset_directory(database: Path) -> Path:
    path = database.parent / f"{database.stem}-assets"
    path.mkdir(parents=True, exist_ok=True)
    return path


def save_image_asset(database: Path, image_bytes: bytes, extension: str) -> str:
    """Persist original/processed image bytes under a generated opaque reference."""
    if extension not in {"jpg", "jpeg", "png", "webp"}:
        raise ValueError("Unsupported image extension.")
    if not image_bytes or len(image_bytes) > 10 * 1024 * 1024:
        raise ValueError("Image asset must be between 1 byte and 10 MB.")
    reference = str(uuid.uuid4())
    path = asset_directory(database) / f"{reference}.{extension}"
    with path.open("xb") as asset_file:
        asset_file.write(image_bytes)
    return reference


def read_image_asset(database: Path, reference: str, extension: str) -> bytes:
    """Read a registered local image by opaque reference, never by caller path."""
    try:
        normalized = str(uuid.UUID(reference))
    except ValueError as error:
        raise ValueError("Invalid asset reference.") from error
    if extension not in {"jpg", "jpeg", "png", "webp"}:
        raise ValueError("Unsupported image extension.")
    path = asset_directory(database) / f"{normalized}.{extension}"
    if not path.is_file():
        raise FileNotFoundError("Image asset was not found.")
    return path.read_bytes()
