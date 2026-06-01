"""
AI OCR Service — invoice document extraction pipeline.

Supports: PDF, PNG, JPG/JPEG
Provider: Claude Vision (primary) → OpenAI Vision (fallback)

Extracted fields:
  - supplier_name, supplier_trn
  - customer_name, customer_trn
  - invoice_number, issue_date, due_date
  - currency, subtotal, total_vat, total_amount
  - line_items (name, quantity, unit_price, vat_rate, total)
  - payment_terms, notes

Each field has a confidence score (0.0–1.0).
"""
from __future__ import annotations

import io
import json
import logging
import re
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)

# ─── Extraction prompt ────────────────────────────────────────────────────────

OCR_EXTRACTION_PROMPT = """You are an expert UAE e-invoicing OCR engine.

Extract ALL invoice data from this document and return ONLY valid JSON with this exact structure:

{
  "supplier_name": "string or null",
  "supplier_trn": "15-digit number string or null",
  "supplier_address": "string or null",
  "customer_name": "string or null",
  "customer_trn": "15-digit number string or null",
  "customer_address": "string or null",
  "invoice_number": "string or null",
  "issue_date": "YYYY-MM-DD or null",
  "due_date": "YYYY-MM-DD or null",
  "supply_date": "YYYY-MM-DD or null",
  "currency": "3-letter code (AED/USD/EUR) or null",
  "subtotal": number or null,
  "total_vat": number or null,
  "total_amount": number or null,
  "vat_rate": number or null,
  "payment_terms": "string or null",
  "purchase_order": "string or null",
  "notes": "string or null",
  "invoice_type": "tax_invoice or credit_note or null",
  "line_items": [
    {
      "description": "string",
      "quantity": number,
      "unit": "string or null",
      "unit_price": number,
      "vat_rate_pct": number,
      "line_total": number
    }
  ],
  "confidence": {
    "overall": 0.0-1.0,
    "supplier_trn": 0.0-1.0,
    "customer_trn": 0.0-1.0,
    "amounts": 0.0-1.0,
    "dates": 0.0-1.0,
    "line_items": 0.0-1.0
  },
  "warnings": ["list of any extraction issues or ambiguities"]
}

Rules:
- TRN must be exactly 15 digits — if unsure, set to null and add a warning
- Dates must be YYYY-MM-DD format
- Numbers must be plain numbers (no currency symbols)
- UAE VAT is 5% standard rate — validate amounts accordingly
- If a field is not visible or unclear, use null
- confidence scores: 1.0 = certain, 0.7 = likely, 0.4 = uncertain, 0.0 = not found
- Return ONLY the JSON object — no markdown, no explanation"""


# ─── Result types ─────────────────────────────────────────────────────────────

@dataclass
class OCRLineItem:
    description: str
    quantity: float = 1.0
    unit: Optional[str] = None
    unit_price: float = 0.0
    vat_rate_pct: float = 5.0
    line_total: float = 0.0


@dataclass
class OCRConfidence:
    overall: float = 0.0
    supplier_trn: float = 0.0
    customer_trn: float = 0.0
    amounts: float = 0.0
    dates: float = 0.0
    line_items: float = 0.0


@dataclass
class OCRExtractionResult:
    # Supplier
    supplier_name: Optional[str] = None
    supplier_trn: Optional[str] = None
    supplier_address: Optional[str] = None

    # Customer
    customer_name: Optional[str] = None
    customer_trn: Optional[str] = None
    customer_address: Optional[str] = None

    # Invoice identity
    invoice_number: Optional[str] = None
    issue_date: Optional[str] = None
    due_date: Optional[str] = None
    supply_date: Optional[str] = None
    invoice_type: Optional[str] = None

    # Financials
    currency: str = 'AED'
    subtotal: Optional[float] = None
    total_vat: Optional[float] = None
    total_amount: Optional[float] = None
    vat_rate: Optional[float] = None

    # Metadata
    payment_terms: Optional[str] = None
    purchase_order: Optional[str] = None
    notes: Optional[str] = None

    # Line items
    line_items: list[OCRLineItem] = field(default_factory=list)

    # Quality
    confidence: OCRConfidence = field(default_factory=OCRConfidence)
    warnings: list[str] = field(default_factory=list)
    raw_text: str = ''
    provider_used: str = ''
    error: Optional[str] = None

    @property
    def is_valid(self) -> bool:
        return self.error is None and self.confidence.overall >= 0.3

    @property
    def needs_review(self) -> bool:
        return (
            self.confidence.overall < 0.7
            or self.confidence.supplier_trn < 0.8
            or self.confidence.amounts < 0.7
            or bool(self.warnings)
        )

    def to_dict(self) -> dict:
        return {
            'supplier_name':     self.supplier_name,
            'supplier_trn':      self.supplier_trn,
            'supplier_address':  self.supplier_address,
            'customer_name':     self.customer_name,
            'customer_trn':      self.customer_trn,
            'customer_address':  self.customer_address,
            'invoice_number':    self.invoice_number,
            'issue_date':        self.issue_date,
            'due_date':          self.due_date,
            'supply_date':       self.supply_date,
            'invoice_type':      self.invoice_type,
            'currency':          self.currency,
            'subtotal':          self.subtotal,
            'total_vat':         self.total_vat,
            'total_amount':      self.total_amount,
            'vat_rate':          self.vat_rate,
            'payment_terms':     self.payment_terms,
            'purchase_order':    self.purchase_order,
            'notes':             self.notes,
            'line_items': [
                {
                    'description':  li.description,
                    'quantity':     li.quantity,
                    'unit':         li.unit,
                    'unit_price':   li.unit_price,
                    'vat_rate_pct': li.vat_rate_pct,
                    'line_total':   li.line_total,
                }
                for li in self.line_items
            ],
            'confidence': {
                'overall':      self.confidence.overall,
                'supplier_trn': self.confidence.supplier_trn,
                'customer_trn': self.confidence.customer_trn,
                'amounts':      self.confidence.amounts,
                'dates':        self.confidence.dates,
                'line_items':   self.confidence.line_items,
            },
            'warnings':      self.warnings,
            'provider_used': self.provider_used,
            'needs_review':  self.needs_review,
        }


# ─── Service ──────────────────────────────────────────────────────────────────

class OCRService:
    """
    AI-powered invoice OCR pipeline.

    Architecture:
      1. Detect file type (PDF/PNG/JPG)
      2. For PDF: extract bytes directly (Claude supports PDF natively)
         For images: pass bytes directly
      3. Call AI vision provider with structured extraction prompt
      4. Parse + validate JSON response
      5. Return OCRExtractionResult with confidence scores
    """

    def extract(
        self,
        file_bytes: bytes,
        mime_type: str,
        filename: str = '',
    ) -> OCRExtractionResult:
        """
        Extract invoice data from a document.

        Args:
            file_bytes: Raw file bytes (PDF, PNG, JPG).
            mime_type:  MIME type string.
            filename:   Original filename (for logging).

        Returns:
            OCRExtractionResult with all extracted fields + confidence scores.
        """
        from .registry import get_vision_provider

        logger.info('OCR extraction: file=%s mime=%s size=%d bytes',
                    filename, mime_type, len(file_bytes))

        # Validate file type
        supported = {'application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'}
        if mime_type not in supported:
            return OCRExtractionResult(
                error=f'Unsupported file type: {mime_type}. Supported: PDF, PNG, JPG.',
            )

        # Normalize JPEG
        if mime_type == 'image/jpg':
            mime_type = 'image/jpeg'

        # For OpenAI (which doesn't support PDF natively), convert first page to image
        try:
            provider = get_vision_provider()
        except RuntimeError as exc:
            return OCRExtractionResult(error=str(exc))

        if mime_type == 'application/pdf' and provider.name == 'openai':
            file_bytes, mime_type = self._pdf_to_image(file_bytes)
            if not file_bytes:
                return OCRExtractionResult(
                    error='PDF processing failed. Please upload a PNG or JPG instead.',
                )

        try:
            vision_response = provider.vision(
                image_data=file_bytes,
                prompt=OCR_EXTRACTION_PROMPT,
                mime_type=mime_type,
                max_tokens=4096,
            )
        except Exception as exc:
            logger.error('OCR vision call failed: %s', exc)
            return OCRExtractionResult(
                error=f'AI extraction failed: {exc}',
                provider_used=getattr(provider, 'name', ''),
            )

        raw_text = vision_response.content
        result   = self._parse_response(raw_text)
        result.raw_text      = raw_text[:2000]   # store excerpt for debug
        result.provider_used = provider.name

        self._validate_trn(result)
        self._validate_amounts(result)
        logger.info('OCR complete: confidence=%.2f warnings=%d provider=%s',
                    result.confidence.overall, len(result.warnings), result.provider_used)
        return result

    def _pdf_to_image(self, pdf_bytes: bytes) -> tuple[bytes, str]:
        """Convert first PDF page to JPEG for providers that don't support PDF."""
        try:
            from pdf2image import convert_from_bytes  # type: ignore
            images = convert_from_bytes(pdf_bytes, dpi=200, first_page=1, last_page=1)
            if not images:
                return b'', 'image/jpeg'
            buf = io.BytesIO()
            images[0].save(buf, format='JPEG', quality=90)
            return buf.getvalue(), 'image/jpeg'
        except ImportError:
            logger.warning('pdf2image not installed — cannot convert PDF for OpenAI provider')
            return b'', 'image/jpeg'
        except Exception as exc:
            logger.error('PDF conversion failed: %s', exc)
            return b'', 'image/jpeg'

    def _parse_response(self, raw: str) -> OCRExtractionResult:
        """Parse the AI JSON response into a structured result."""
        # Strip markdown code fences if present
        text = raw.strip()
        if text.startswith('```'):
            text = re.sub(r'^```(?:json)?\n?', '', text)
            text = re.sub(r'\n?```$', '', text)

        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            # Try to extract JSON block from text
            match = re.search(r'\{.*\}', text, re.DOTALL)
            if match:
                try:
                    data = json.loads(match.group())
                except json.JSONDecodeError:
                    return OCRExtractionResult(
                        error='AI returned malformed JSON. Please retry.',
                        raw_text=raw[:500],
                    )
            else:
                return OCRExtractionResult(
                    error='AI did not return valid JSON. Please retry.',
                    raw_text=raw[:500],
                )

        # Build result
        conf_raw = data.get('confidence', {})
        confidence = OCRConfidence(
            overall=float(conf_raw.get('overall', 0.5)),
            supplier_trn=float(conf_raw.get('supplier_trn', 0.5)),
            customer_trn=float(conf_raw.get('customer_trn', 0.5)),
            amounts=float(conf_raw.get('amounts', 0.5)),
            dates=float(conf_raw.get('dates', 0.5)),
            line_items=float(conf_raw.get('line_items', 0.5)),
        )

        line_items = []
        for li in data.get('line_items', []):
            line_items.append(OCRLineItem(
                description=str(li.get('description', '')),
                quantity=float(li.get('quantity') or 1),
                unit=li.get('unit'),
                unit_price=float(li.get('unit_price') or 0),
                vat_rate_pct=float(li.get('vat_rate_pct') or 5),
                line_total=float(li.get('line_total') or 0),
            ))

        return OCRExtractionResult(
            supplier_name=data.get('supplier_name'),
            supplier_trn=data.get('supplier_trn'),
            supplier_address=data.get('supplier_address'),
            customer_name=data.get('customer_name'),
            customer_trn=data.get('customer_trn'),
            customer_address=data.get('customer_address'),
            invoice_number=data.get('invoice_number'),
            issue_date=data.get('issue_date'),
            due_date=data.get('due_date'),
            supply_date=data.get('supply_date'),
            invoice_type=data.get('invoice_type'),
            currency=data.get('currency') or 'AED',
            subtotal=self._safe_float(data.get('subtotal')),
            total_vat=self._safe_float(data.get('total_vat')),
            total_amount=self._safe_float(data.get('total_amount')),
            vat_rate=self._safe_float(data.get('vat_rate')),
            payment_terms=data.get('payment_terms'),
            purchase_order=data.get('purchase_order'),
            notes=data.get('notes'),
            line_items=line_items,
            confidence=confidence,
            warnings=data.get('warnings', []),
        )

    def _validate_trn(self, result: OCRExtractionResult) -> None:
        """Validate TRN format — must be exactly 15 digits."""
        for attr in ('supplier_trn', 'customer_trn'):
            trn = getattr(result, attr)
            if trn is not None:
                trn_clean = re.sub(r'\D', '', str(trn))
                if len(trn_clean) == 15:
                    setattr(result, attr, trn_clean)
                else:
                    result.warnings.append(
                        f'{attr} "{trn}" is not 15 digits — cleared for manual review.'
                    )
                    setattr(result, attr, None)
                    if attr == 'supplier_trn':
                        result.confidence.supplier_trn = 0.0
                    else:
                        result.confidence.customer_trn = 0.0

    def _validate_amounts(self, result: OCRExtractionResult) -> None:
        """Sanity-check VAT arithmetic."""
        if (result.subtotal is not None
                and result.total_vat is not None
                and result.total_amount is not None):
            expected_total = round(result.subtotal + result.total_vat, 2)
            actual_total   = round(result.total_amount, 2)
            if abs(expected_total - actual_total) > 1.00:
                result.warnings.append(
                    f'Amount mismatch: subtotal {result.subtotal} + VAT {result.total_vat} '
                    f'= {expected_total}, but total is {actual_total}.'
                )
                result.confidence.amounts = min(result.confidence.amounts, 0.5)

    @staticmethod
    def _safe_float(val) -> Optional[float]:
        if val is None:
            return None
        try:
            return float(val)
        except (TypeError, ValueError):
            return None
