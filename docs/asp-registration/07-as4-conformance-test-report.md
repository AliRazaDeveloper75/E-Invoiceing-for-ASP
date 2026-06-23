# AS4 Conformance Test Report

**Document:** PEPPOL AS4 / eDelivery Conformance Summary
**Service Provider:** AL MERAK TAX CONSULTANT L.L.C (E-Numerak)
**AP Seat ID (test):** PAE001147
**Participant ID:** 0235:104132266800003
**Date:** 2026-06-23

---

## 1. Purpose

This report summarises the conformance testing completed by E-Numerak's Access
Point against the OpenPEPPOL Testbed, demonstrating compliance with the PEPPOL
AS4 Profile v2.0 (eDelivery) and the UAE PINT-AE specifications. All suites below
were executed with the **test PKI (G3)** certificate; they will be re-executed
with the **production PKI** certificate for final accreditation.

---

## 2. eDelivery — Standalone Access Point suite (6/6 — PASSED)

| # | Test case | Result |
|---|-----------|--------|
| TC2A.1 | TLS connection | ✅ Pass |
| TC2A.2B | AS4 message reception | ✅ Pass |
| TC2A.3 | AS4 message submission | ✅ Pass |
| TC2A.4 | Invalid certificate handling (CRL revocation) | ✅ Pass |
| TC2A.5B | Large message reception | ✅ Pass |
| TC2A.6 | Large message submission | ✅ Pass |

Report on file: `TestBedReport-PAE001147-20260609T122213.pdf`.

---

## 3. PKI G3 suite (3/3 — PASSED)

| # | Test case | Result |
|---|-----------|--------|
| 1 | Valid certificate reception | ✅ Pass |
| 2 | Invalid certificate reception (rejected via signer-trust gate) | ✅ Pass |
| 3 | G3 submission + signal | ✅ Pass |

Report on file: `TestBedReport-PAE001147-20260609T135555.pdf`.

---

## 4. UAE PINT-AE specification suites (PASSED — test PKI)

| Suite | Result |
|-------|--------|
| Billing 1.0.4 | ✅ 12/12 |
| Billing 1.0.4 & AE TDD 1.0.3 | ✅ 12/12 |
| Self-Billing 1.0.4 | ✅ 11/11 |
| Self-Billing 1.0.4 & AE TDD 1.0.3 | ✅ 11/11 |

Covers: invoice & credit-note reception/submission (exact + wildcard match),
invalid-document handling (Schematron + syntax), Message Level Status (MLS /
ApplicationResponse), and AE Tax Data Document (TDD) reporting to the Tax
Authority (C5). Reports on file (e.g. `TestBedReport-PAE001147-20260618T082253.pdf`).

---

## 5. Technical conformance summary

| Layer | Implementation |
|-------|----------------|
| Transport | AS4 / ebMS 3.0, One-Way/Push MEP, MTOM |
| Security | WS-Security: XML-DSig **RSA-SHA256**, Exclusive C14N, SHA-256 digests |
| Encryption | Payload gzip + **AES-128-GCM**, key wrapped with **RSA-OAEP (SHA-256/MGF1)** |
| Receipts | AS4 non-repudiation Receipt; eb:Error on failure |
| Discovery | SML/SMK + SMP dynamic discovery (exact + wildcard) |
| Trust | Recipient + signer certificate chain & CRL validation |
| Profiles | PINT-AE Billing & Self-Billing (1.0.4), AE TDD 1.0.3 |

---

## 6. Status & next step

- **Test PKI conformance: COMPLETE** across all suites above.
- **Production PKI re-run: PENDING** — to be executed once the production
  certificate is issued, after which this report will be re-issued with the
  production test-run references for final UAE accreditation.
