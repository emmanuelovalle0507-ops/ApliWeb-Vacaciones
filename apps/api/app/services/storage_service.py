"""File storage abstraction — local filesystem for dev, S3-ready for prod."""

from __future__ import annotations

import os
import uuid
from pathlib import Path

from app.core.config import settings


class StorageService:
    def __init__(self) -> None:
        self.backend = settings.storage_backend
        self.base_dir = Path(settings.upload_dir)
        self.max_bytes = settings.max_upload_size_mb * 1024 * 1024
        self.allowed_types = [t.strip() for t in settings.allowed_upload_types.split(",") if t.strip()]

    def validate(self, content_type: str, size: int, data: bytes | None = None) -> None:
        if content_type not in self.allowed_types:
            raise ValueError(
                f"Tipo de archivo no permitido: {content_type}. "
                f"Permitidos: {', '.join(self.allowed_types)}"
            )
        if size > self.max_bytes:
            raise ValueError(
                f"Archivo demasiado grande ({size / 1024 / 1024:.1f} MB). "
                f"Máximo: {settings.max_upload_size_mb} MB."
            )
        if size == 0:
            raise ValueError("El archivo está vacío.")
        # Validate magic bytes match declared content type
        if data and len(data) >= 4:
            if not _magic_matches(data, content_type):
                raise ValueError(
                    "El contenido del archivo no coincide con el tipo declarado. "
                    "Asegúrate de subir una imagen o PDF válido."
                )

    def save(self, data: bytes, owner_id: str, original_name: str, content_type: str) -> str:
        """Save file and return the storage key (relative path)."""
        ext = _ext_from_content_type(content_type) or Path(original_name).suffix
        file_id = uuid.uuid4().hex
        key = f"expenses/{owner_id}/{file_id}{ext}"

        if self.backend == "local":
            full_path = self.base_dir / key
            full_path.parent.mkdir(parents=True, exist_ok=True)
            full_path.write_bytes(data)
        else:
            raise NotImplementedError(f"Storage backend '{self.backend}' not implemented yet.")

        return key

    def get_full_path(self, key: str) -> Path:
        """Return the absolute filesystem path for a local file."""
        return self.base_dir / key

    def delete(self, key: str) -> None:
        if self.backend == "local":
            path = self.base_dir / key
            if path.exists():
                path.unlink()


def _ext_from_content_type(ct: str) -> str:
    mapping = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "application/pdf": ".pdf",
        "text/xml": ".xml",
        "application/xml": ".xml",
    }
    return mapping.get(ct, "")


def _magic_matches(data: bytes, content_type: str) -> bool:
    """Check if file magic bytes match the declared content type."""
    checks: dict[str, list[bytes]] = {
        "image/jpeg": [b"\xff\xd8\xff"],
        "image/png": [b"\x89PNG"],
        "image/webp": [b"RIFF"],
        "application/pdf": [b"%PDF"],
    }
    # XML files may have BOM or whitespace before the declaration — handle separately
    if content_type in ("text/xml", "application/xml"):
        stripped = data.lstrip(b"\xef\xbb\xbf \t\r\n")[:50]
        return stripped.startswith(b"<?xml") or stripped.startswith(b"<cfdi") or stripped.startswith(b"<Comprobante")
    signatures = checks.get(content_type)
    if not signatures:
        return True  # Unknown type, skip check
    return any(data[:len(sig)] == sig for sig in signatures)
