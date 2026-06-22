# API / Integration Documentation

**Document:** E-Numerak REST API & PEPPOL Integration Reference
**Service Provider:** AL MERAK TAX CONSULTANT L.L.C
**Base URL:** `https://api.e-numerak.com`
**API version prefix:** `/api/v1/`
**Date:** 2026-06-20

---

## 1. Overview

E-Numerak exposes a versioned REST API (Django REST Framework). All business
endpoints are mounted under `/api/v1/`. Authentication is **JWT (bearer token)**,
except the public health probes and the machine-to-machine PEPPOL AS4 receiving
endpoint.

| Concern | Value |
|---------|-------|
| Auth | `Authorization: Bearer <access_token>` (JWT) |
| Content type | `application/json` (except AS4: SOAP/MTOM) |
| Versioning | URL prefix `/api/v1/` |
| IDs | UUID v4 |
| Transport | HTTPS / TLS only |

### Health probes (no auth)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health/` | Liveness |
| GET | `/ready/` | Readiness (DB/cache) |

---

## 2. Authentication — `/api/v1/auth/`

| Method | Path | Description |
|--------|------|-------------|
| POST | `check-email/` | Check if an email is registered |
| POST | `register/` | Register a new account |
| POST | `login/` | Obtain JWT access + refresh tokens |
| POST | `logout/` | Invalidate refresh token |
| POST | `token/refresh/` | Refresh access token |
| GET/PATCH | `me/` | Current user profile |
| POST | `change-password/` | Change password |
| POST | `verify-email/`, `resend-verification/` | Email verification |
| POST | `forgot-password/`, `reset-password/` | Password reset |
| POST | `mfa/setup/`, `mfa/enable/`, `mfa/disable/`, GET `mfa/status/` | MFA (TOTP) management |
| POST | `mfa/verify-login/`, `mfa/setup-login/`, `mfa/enable-login/` | MFA at login |

**Login example:**
```http
POST /api/v1/auth/login/
Content-Type: application/json

{ "email": "user@example.com", "password": "••••••" }
```
```json
{ "access": "<jwt>", "refresh": "<jwt>", "user": { "...": "..." } }
```

---

## 3. Companies — `/api/v1/companies/`

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `` | List / create companies |
| GET/PATCH/DELETE | `{company_id}/` | Company detail |
| GET/POST | `{company_id}/members/` | List / add members |
| GET/PATCH/DELETE | `{company_id}/members/{member_id}/` | Member detail |

Related: `/api/v1/customers/`, `/api/v1/taxes/`, `/api/v1/onboarding/`.

---

## 4. Invoices — `/api/v1/invoices/`

Core outbound (PEPPOL sending) surface.

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `` | List / create invoices |
| GET/PATCH/DELETE | `{invoice_id}/` | Invoice detail |
| POST | `{invoice_id}/validate/` | Pre-submit PINT-AE validation (XSD + Schematron) |
| POST | `{invoice_id}/submit/` | **Generate UBL, validate, send via PEPPOL AS4** |
| POST | `{invoice_id}/cancel/` | Cancel |
| POST | `{invoice_id}/deactivate/` | Deactivate |
| POST | `{invoice_id}/credit-note/` | Issue a credit note |
| GET | `{invoice_id}/download-xml/` | Download the PINT-AE UBL XML |
| GET | `{invoice_id}/download-pdf/` | Download the PDF rendering |
| GET | `{invoice_id}/vat-summary/` | VAT breakdown |
| GET/POST | `{invoice_id}/items/` , `{invoice_id}/items/{item_id}/` | Line items |
| POST | `{invoice_id}/report-fta/` | Manual FTA (TDD) re-report |
| GET | `{invoice_id}/payments/` | Supplier payment view |
| GET | `dashboard/`, `export/`, `gap-report/` | Reporting helpers |
| GET/POST | `products/`, `products/{pk}/` | Product catalog |

**Submit flow (what `/submit/` does internally):**
1. Build PINT-AE UBL (`services/xml_generator`).
2. Validate (`services/peppol/pint_ae`) — reject if invalid.
3. SMP discovery of receiver (`services/smp_client`).
4. Validate recipient cert (`services/as4/cert_validation`).
5. Sign + encrypt + send AS4 (`services/as4/*`).
6. Generate + submit AE TDD to C5 (`services/peppol/tdd`).

---

## 5. Inbound (PEPPOL receiving, C3) — `/api/v1/inbound/`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `as4/` | **None (m2m)** | **PEPPOL AS4 receiving endpoint (Corner 3)** |
| POST | `submit/` | JWT | Supplier-facing submission |
| GET | `` | JWT | List received invoices |
| GET | `stats/` | JWT | Inbound statistics |
| GET | `{pk}/` | JWT | Received invoice detail |
| POST | `{pk}/approve/`, `{pk}/reject/` | JWT | Approve / reject |
| POST | `{pk}/resend-observation/` | JWT | Resend MLS observation |
| GET/POST | `suppliers/`, `suppliers/activate/` | JWT | Supplier management |
| GET/POST | `portal/`, `portal/submit/` | JWT (inbound_supplier role) | Supplier portal |

**AS4 receiving endpoint** (the address registered in our SMP):
```
POST https://api.e-numerak.com/api/v1/inbound/as4/
Content-Type: multipart/related; ... (SOAP 1.2 + MTOM)
```
On receipt the AP verifies signature + signer trust, decrypts, validates the
PINT-AE document, stores it, and returns an **MLS ApplicationResponse**
(AB=accepted / RE=rejected).

---

## 6. Other modules

| Prefix | Module |
|--------|--------|
| `/api/v1/reports/` | Reporting |
| `/api/v1/ocr/` | AI OCR (invoice scanning) |
| `/api/v1/fraud/` | Fraud detection |
| `/api/v1/chat/` | Assistant chat |
| `/api/v1/buyers/`, `/api/v1/buyer/` | Buyer portal (invite + portal) |
| `/api/v1/admin/` | Admin panel |
| `/admin/` | Django admin |

---

## 7. PEPPOL identifiers (integration constants)

| Item | Value |
|------|-------|
| Participant ID | `0235:104132266800003` (scheme 0235 = UAE) |
| AS4 transport profile | `peppol-transport-as4-v2_0` |
| PINT-AE Billing CustomizationID | `urn:peppol:pint:billing-1@ae-1` |
| PINT-AE Self-Billing CustomizationID | `urn:peppol:pint:selfbilling-1@ae-1` |
| AE TDD CustomizationID | `urn:peppol:taxdata:ae-1` |
| Process (billing) | `urn:peppol:bis:billing` |
| Process (tax reporting) | `urn:peppol:taxreporting` |

---

## 8. Error model

Standard HTTP status codes; error bodies are JSON:
```json
{ "detail": "human-readable message", "code": "optional_error_code" }
```
- `400` validation error · `401` unauthenticated · `403` forbidden ·
  `404` not found · `409` conflict (state) · `422` document validation failed ·
  `500` server error.
