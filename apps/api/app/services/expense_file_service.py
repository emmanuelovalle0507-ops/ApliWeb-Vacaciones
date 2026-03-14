from __future__ import annotations

import hashlib
import os
import uuid
from pathlib import Path

from fastapi import UploadFile

from app.core.config import settings


class ExpenseFileService:
    def __init__(self) -> None:
        self.base_dir = Path(settings.expense_upload_dir).expanduser().resolve()
        self.max_bytes = settings.expense_max_file_mb * 1024 * 1024
        self.allowed_mime = {item.strip() for item in settings.expense_allowed_mime.split(',') if item.strip()}
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def validate_upload(self, file: UploadFile) -> None:
        if not file.filename:
            raise ValueError("El archivo no tiene nombre.")
        content_type = (file.content_type or "").split(";")[0].strip().lower()
        if content_type not in self.allowed_mime:
            raise ValueError("Tipo de archivo no permitido.")

    async def save(self, file: UploadFile) -> dict:
        self.validate_upload(file)
        content = await file.read()
        size = len(content)
        if size == 0:
            raise ValueError("El archivo está vacío.")
        if size > self.max_bytes:
            raise ValueError(f"El archivo excede el máximo de {settings.expense_max_file_mb} MB.")

        ext = Path(file.filename or "document").suffix.lower()[:10]
        today_dir = self.base_dir / uuid.uuid4().hex[:4]
        today_dir.mkdir(parents=True, exist_ok=True)
        stored_filename = f"{uuid.uuid4().hex}{ext}"
        stored_path = today_dir / stored_filename
        stored_path.write_bytes(content)

        checksum = hashlib.sha256(content).hexdigest()
        return {
            "stored_filename": stored_filename,
            "storage_path": str(stored_path),
            "mime_type": (file.content_type or "application/octet-stream").split(";")[0].strip().lower(),
            "file_size": size,
            "checksum": checksum,
            "original_filename": file.filename,
        }

    def read_text_preview(self, storage_path: str) -> str | None:
        path = Path(storage_path)
        if not path.exists() or not path.is_file():
            return None
        if path.suffix.lower() not in {".xml", ".txt"}:
            return None
        try:
            return path.read_text(encoding="utf-8", errors="ignore")[:12000]
        except OSError:
            return None
