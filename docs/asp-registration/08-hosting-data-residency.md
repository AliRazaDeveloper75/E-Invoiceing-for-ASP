# Hosting & Data Residency Confirmation

**Document:** Hosting Environment & Data Residency
**Service Provider:** AL MERAK TAX CONSULTANT L.L.C (E-Numerak)
**Date:** 2026-06-23

> **ACTION REQUIRED — confirm/complete the [PLACEHOLDER] items below with your
> hosting provider before submission.** UAE e-invoicing accreditation may
> require invoice data to be stored within the UAE; verify your server region.

---

## 1. Hosting environment

| Item | Detail |
|------|--------|
| Provider | **[PLACEHOLDER — e.g. Hostinger / AWS / local UAE DC]** |
| Region / Data centre | **[PLACEHOLDER — confirm UAE region if required]** |
| Server | Linux VPS (Ubuntu 24.04 LTS), Docker-based deployment |
| Public services | HTTPS (443) and HTTP→HTTPS redirect (80) only |
| Domains | `e-numerak.com` (app), `api.e-numerak.com` (API), `smp.e-numerak.com` (SMP) |

## 2. Architecture (containers)

- **nginx** — TLS termination + reverse proxy
- **backend** — Django REST API (Gunicorn)
- **frontend** — Next.js application
- **PostgreSQL** — primary database (invoices, customers, audit)
- **Redis** — cache / task queue
- **Celery worker + beat** — background tasks (cert monitoring, TDD)
- **phoss-SMP** — Service Metadata Publisher (localhost-bound)

## 3. Data residency

- All invoice data, customer records, and uploaded documents are stored on the
  hosting environment above and on a **persistent storage volume** (`media_files`)
  on the same host.
- Uploaded media (logos, TRN documents, generated XML/PDF) is **not** sent to any
  third-party storage by default (S3 is optional and currently disabled).
- **Data residency confirmation:** **[PLACEHOLDER — state that production data
  is hosted within the UAE, or describe the compliant arrangement / region.]**

## 4. Network & access security (in place)

| Control | Status |
|---------|--------|
| OS firewall (ufw) — only 22/80/443 open | ✅ Active |
| Brute-force protection (fail2ban) | ✅ Active |
| Malware scanning (ClamAV, weekly) | ✅ Active |
| Resource monitoring (Netdata) | ✅ Active |
| TLS (HTTPS) on all public endpoints | ✅ Active |
| Email authentication (SPF, DKIM, DMARC) | ✅ Active |

## 5. Encryption

- **In transit:** TLS (HTTPS); PEPPOL payloads additionally signed (RSA-SHA256)
  and encrypted (AES-128-GCM + RSA-OAEP) at the message level.
- **At rest:** database and uploaded documents reside on the host volume;
  **[PLACEHOLDER — note disk encryption if enabled by the provider.]**

---

**Confirmation:** We confirm the platform is hosted and operated as described
above, and that production invoice data residency complies with applicable UAE
requirements. *(Sign + date on submission.)*

_____________________________      Date: __________
Authorised signatory, AL MERAK TAX CONSULTANT L.L.C
