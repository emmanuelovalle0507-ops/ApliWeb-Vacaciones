"""Unit tests for expenses module — storage validation, extraction parsing, edge cases."""

import pytest
from unittest.mock import patch, MagicMock

from app.services.storage_service import StorageService, _magic_matches


# ── Storage validation ─────────────────────────────────────────

class TestStorageValidation:
    def setup_method(self):
        self.svc = StorageService()

    def test_rejects_disallowed_content_type(self):
        with pytest.raises(ValueError, match="Tipo de archivo no permitido"):
            self.svc.validate("text/html", 100)

    def test_rejects_oversized_file(self):
        max_bytes = self.svc.max_bytes
        with pytest.raises(ValueError, match="demasiado grande"):
            self.svc.validate("image/jpeg", max_bytes + 1)

    def test_rejects_empty_file(self):
        with pytest.raises(ValueError, match="vacío"):
            self.svc.validate("image/jpeg", 0)

    def test_accepts_valid_jpeg(self):
        # JPEG magic bytes
        data = b"\xff\xd8\xff\xe0" + b"\x00" * 100
        self.svc.validate("image/jpeg", len(data), data)  # Should not raise

    def test_accepts_valid_png(self):
        data = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
        self.svc.validate("image/png", len(data), data)

    def test_accepts_valid_pdf(self):
        data = b"%PDF-1.4" + b"\x00" * 100
        self.svc.validate("application/pdf", len(data), data)

    def test_rejects_spoofed_content_type(self):
        # Data is a JPEG but declared as PNG
        data = b"\xff\xd8\xff\xe0" + b"\x00" * 100
        with pytest.raises(ValueError, match="no coincide"):
            self.svc.validate("image/png", len(data), data)

    def test_rejects_script_as_image(self):
        data = b"<script>alert(1)</script>"
        with pytest.raises(ValueError, match="no coincide"):
            self.svc.validate("image/jpeg", len(data), data)


# ── Magic bytes helper ─────────────────────────────────────────

class TestMagicMatches:
    def test_jpeg_valid(self):
        assert _magic_matches(b"\xff\xd8\xff\xe0data", "image/jpeg") is True

    def test_jpeg_invalid(self):
        assert _magic_matches(b"\x89PNGdata", "image/jpeg") is False

    def test_png_valid(self):
        assert _magic_matches(b"\x89PNGdata", "image/png") is True

    def test_pdf_valid(self):
        assert _magic_matches(b"%PDF-1.4data", "application/pdf") is True

    def test_webp_valid(self):
        assert _magic_matches(b"RIFF1234WEBP", "image/webp") is True

    def test_unknown_type_passes(self):
        assert _magic_matches(b"anything", "application/octet-stream") is True


# ── Receipt extraction parsing ─────────────────────────────────

class TestExtractionParsing:
    """Test the ReceiptExtractionService normalization helpers."""

    def test_safe_str_truncates(self):
        from app.services.receipt_extraction_service import ReceiptExtractionService
        assert ReceiptExtractionService._safe_str("hello", 3) == "hel"

    def test_safe_str_none(self):
        from app.services.receipt_extraction_service import ReceiptExtractionService
        assert ReceiptExtractionService._safe_str(None) is None

    def test_safe_str_empty(self):
        from app.services.receipt_extraction_service import ReceiptExtractionService
        assert ReceiptExtractionService._safe_str("") is None

    def test_safe_float_valid(self):
        from app.services.receipt_extraction_service import ReceiptExtractionService
        assert ReceiptExtractionService._safe_float("123.45") == 123.45

    def test_safe_float_none(self):
        from app.services.receipt_extraction_service import ReceiptExtractionService
        assert ReceiptExtractionService._safe_float(None) is None

    def test_safe_float_garbage(self):
        from app.services.receipt_extraction_service import ReceiptExtractionService
        assert ReceiptExtractionService._safe_float("not-a-number") is None

    def test_safe_date_valid(self):
        from app.services.receipt_extraction_service import ReceiptExtractionService
        from datetime import date
        assert ReceiptExtractionService._safe_date("2026-03-10") == date(2026, 3, 10)

    def test_safe_date_invalid(self):
        from app.services.receipt_extraction_service import ReceiptExtractionService
        assert ReceiptExtractionService._safe_date("not-a-date") is None

    def test_safe_date_none(self):
        from app.services.receipt_extraction_service import ReceiptExtractionService
        assert ReceiptExtractionService._safe_date(None) is None


# ── LLM extract_receipt JSON parsing ───────────────────────────

class TestLLMExtractReceipt:
    """Test that extract_receipt correctly parses vision response."""

    @patch("app.services.llm_service.LLMService._chat_vision")
    def test_parses_clean_json(self, mock_vision):
        from app.services.llm_service import LLMService, LLMResult
        mock_vision.return_value = LLMResult(text='{"vendor_name": "OXXO", "total_amount": 125.50, "confidence": 0.92}')

        svc = LLMService()
        svc.enabled = True
        result = svc.extract_receipt("base64data", "image/jpeg")

        assert result is not None
        assert result["vendor_name"] == "OXXO"
        assert result["total_amount"] == 125.50
        assert result["confidence"] == 0.92

    @patch("app.services.llm_service.LLMService._chat_vision")
    def test_strips_markdown_fences(self, mock_vision):
        from app.services.llm_service import LLMService, LLMResult
        mock_vision.return_value = LLMResult(text='```json\n{"vendor_name": "Pemex"}\n```')

        svc = LLMService()
        svc.enabled = True
        result = svc.extract_receipt("base64data", "image/jpeg")

        assert result is not None
        assert result["vendor_name"] == "Pemex"

    @patch("app.services.llm_service.LLMService._chat_vision")
    def test_returns_none_on_invalid_json(self, mock_vision):
        from app.services.llm_service import LLMService, LLMResult
        mock_vision.return_value = LLMResult(text="This is not JSON at all")

        svc = LLMService()
        svc.enabled = True
        result = svc.extract_receipt("base64data", "image/jpeg")

        assert result is None

    @patch("app.services.llm_service.LLMService._chat_vision")
    def test_returns_none_on_empty_response(self, mock_vision):
        from app.services.llm_service import LLMService
        mock_vision.return_value = None

        svc = LLMService()
        svc.enabled = True
        result = svc.extract_receipt("base64data", "image/jpeg")

        assert result is None


# ── UUID validation ────────────────────────────────────────────

class TestUUIDValidation:
    def test_valid_uuid(self):
        from app.api.v1.expenses import _valid_uuid
        assert _valid_uuid("550e8400-e29b-41d4-a716-446655440000") is True

    def test_invalid_uuid(self):
        from app.api.v1.expenses import _valid_uuid
        assert _valid_uuid("not-a-uuid") is False

    def test_empty_string(self):
        from app.api.v1.expenses import _valid_uuid
        assert _valid_uuid("") is False

    def test_sql_injection_attempt(self):
        from app.api.v1.expenses import _valid_uuid
        assert _valid_uuid("'; DROP TABLE users; --") is False
