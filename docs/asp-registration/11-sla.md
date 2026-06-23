# Service Level Agreement (SLA)

**Document:** Service Level Agreement
**Service Provider:** AL MERAK TAX CONSULTANT L.L.C (E-Numerak)
**Date:** 2026-06-23

> Confirm/adjust the **[PLACEHOLDER]** commitment values to those you can
> guarantee before submission.

---

## 1. Scope

This SLA covers the E-Numerak PEPPOL Access Point / Service Provider platform:
invoice creation, validation, AS4 send & receive, MLS handling, and AE Tax Data
Document (TDD) reporting to the Tax Authority.

## 2. Availability

| Metric | Commitment |
|--------|------------|
| Platform uptime | **[PLACEHOLDER — e.g. 99.5% monthly]** |
| Measurement | Based on `/health/` availability, excluding planned maintenance |
| Planned maintenance | Notified **[e.g. 48h]** in advance; low-traffic windows |

## 3. Performance targets

| Operation | Target |
|-----------|--------|
| Invoice validation (PINT-AE) | **[e.g. < 5 s]** |
| AS4 send (outbound delivery attempt) | **[e.g. < 30 s]** |
| AS4 receive acknowledgement (Receipt) | Real-time on receipt |
| MLS / TDD generation | **[e.g. within minutes of reception]** |

## 4. Support response (per Operational Support Plan)

| Severity | Response | Resolution target |
|----------|----------|-------------------|
| P1 — Critical (service down) | **[e.g. 1 hour]** | **[e.g. 4 hours]** |
| P2 — High | **[e.g. 4 hours]** | **[e.g. 1 business day]** |
| P3 — Normal | **[e.g. 1 business day]** | **[e.g. 3 business days]** |

## 5. Data protection & retention

- Invoice data and audit logs retained per UAE regulatory requirements
  (**[PLACEHOLDER — e.g. 5 years per FTA]**).
- Backups maintained per the Disaster Recovery & Backup Plan.
- Security controls per the Security & Encryption Policy.

## 6. Security & compliance

- Message-level signing (RSA-SHA256) + encryption (AES-128-GCM / RSA-OAEP).
- TLS on all public endpoints; certificate trust + revocation validation.
- Compliance with PEPPOL AS4 Profile v2.0 and UAE PINT-AE specifications.

## 7. Exclusions

Outages caused by: customer-side network/configuration, third-party PEPPOL
infrastructure (SML/SMP/remote APs) outside our control, force majeure, or
scheduled maintenance with prior notice.

## 8. Review

This SLA is reviewed **[PLACEHOLDER — e.g. annually]** or upon material change.

---

_____________________________      Date: __________
Authorised signatory, AL MERAK TAX CONSULTANT L.L.C
