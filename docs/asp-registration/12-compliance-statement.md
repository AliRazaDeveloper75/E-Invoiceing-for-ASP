# Compliance Statement (FTA / MoF)

**Document:** Regulatory & Standards Compliance Statement
**Service Provider:** AL MERAK TAX CONSULTANT L.L.C (E-Numerak)
**Participant ID:** 0235:104132266800003
**Date:** 2026-06-23

---

## 1. Statement

AL MERAK TAX CONSULTANT L.L.C, operating the **E-Numerak** platform, confirms
that its PEPPOL Access Point / Service Provider implementation is designed and
operated to comply with the United Arab Emirates e-invoicing framework and the
applicable PEPPOL standards, as detailed below.

## 2. UAE regulatory alignment

| Requirement | Compliance |
|-------------|------------|
| UAE e-invoicing framework (5-corner / DCTCE model) | ✅ Implemented (C2 send, C3 receive, C5 tax reporting) |
| Federal Decree-Law No. 16 of 2024 (Tax Invoices — Articles 65, 70, 76) | ✅ Tax invoice issuance, sequence integrity, timeliness |
| VAT — UAE standard rate (5%) & VAT breakdown | ✅ Implemented |
| AE Tax Data Document (TDD 1.0.3) reporting to Tax Authority (C5) | ✅ Implemented & testbed-certified |
| Record retention | Per FTA requirement (**[PLACEHOLDER — e.g. 5 years]**) |

## 3. PEPPOL / technical standards

| Standard | Compliance |
|----------|------------|
| PEPPOL AS4 Profile v2.0 (eDelivery) | ✅ Certified (eDelivery suite 6/6) |
| PEPPOL PKI G3 | ✅ Certified (PKI G3 suite 3/3); production cert pending |
| PINT-AE Billing 1.0.4 | ✅ Testbed-certified |
| PINT-AE Self-Billing 1.0.4 | ✅ Testbed-certified |
| AE TDD 1.0.3 | ✅ Testbed-certified |
| UBL 2.1 / EN 16931 alignment | ✅ Implemented |
| Message Level Status (eDEC MLS) | ✅ Implemented |

## 4. Security & data protection

- Message-level **digital signature** (RSA-SHA256, WS-Security) and **payload
  encryption** (AES-128-GCM + RSA-OAEP) per PEPPOL.
- **TLS** on all public endpoints; certificate **trust + revocation** validation
  (inbound and outbound).
- Network hardening: firewall, intrusion prevention (fail2ban), malware scanning.
- Email authentication: SPF, DKIM, DMARC.
- Access control: JWT authentication, role-based access, MFA.

## 5. Accreditation status

- **Test PKI:** all PEPPOL + PINT-AE conformance suites **passed**.
- **Production PKI:** certificate issuance in progress; all suites will be
  **re-run with the production certificate** to finalise UAE accreditation.

## 6. Declaration

We declare that the information in this statement and the accompanying
documentation is accurate to the best of our knowledge, and we commit to
maintaining compliance with the UAE FTA / Ministry of Finance e-invoicing
requirements and PEPPOL specifications on an ongoing basis.

_____________________________      Date: __________
Authorised signatory, AL MERAK TAX CONSULTANT L.L.C
Name / Title: **[PLACEHOLDER]**
