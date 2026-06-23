# Disaster Recovery & Backup Plan

**Document:** Disaster Recovery (DR) & Backup Plan
**Service Provider:** AL MERAK TAX CONSULTANT L.L.C (E-Numerak)
**Date:** 2026-06-23

> Confirm/adjust the **[PLACEHOLDER]** schedule and retention values to match
> your actual backup configuration before submission.

---

## 1. Objectives

| Metric | Target |
|--------|--------|
| **RPO** (Recovery Point Objective) | **[PLACEHOLDER — e.g. 24 hours]** |
| **RTO** (Recovery Time Objective) | **[PLACEHOLDER — e.g. 4 hours]** |
| Backup retention | **[PLACEHOLDER — e.g. 30 daily / 12 monthly]** |

## 2. What is backed up

| Asset | Method |
|-------|--------|
| **PostgreSQL database** (invoices, customers, audit logs) | `pg_dump` logical backup |
| **Uploaded media** (`media_files` volume: logos, TRN docs, XML/PDF) | Volume / file-level backup |
| **Keystore (PEPPOL AP cert + key)** | Secure, encrypted off-host copy (restricted access) |
| **Configuration** (`.env`, nginx.conf, compose) | Versioned in Git + secured secrets store |
| **Application code** | GitHub repository (version-controlled) |

## 3. Backup schedule

- **Database:** automated daily dump at **[PLACEHOLDER — e.g. 02:00 UTC]**, stored
  on **[PLACEHOLDER — separate location / off-site]**.
- **Media volume:** daily/weekly snapshot **[PLACEHOLDER]**.
- Backups are stored **separately from the production host** to survive host loss.
- **[PLACEHOLDER — note off-site / second-region copy if applicable.]**

## 4. Recovery procedure (summary)

1. Provision a clean host (Docker + compose).
2. Restore configuration + secrets (keystore, `.env`).
3. `git clone` the application; build/run containers.
4. Restore the latest PostgreSQL dump.
5. Restore the media volume.
6. Verify: health checks (`/health/`, `/ready/`), a test invoice create + send,
   and SMP/AS4 endpoint reachability.
7. Re-point DNS if the host changed.

## 5. Continuity controls (in place)

- **Monitoring:** Netdata (CPU/RAM/disk/containers) for early warning.
- **Certificate expiry monitoring:** scheduled Celery task alerts before expiry.
- **Health/readiness probes:** `/health/`, `/ready/`.
- **Version control:** all code + config in Git (rapid redeploy).
- **Idempotent deploys:** documented deploy workflow (containerised).

## 6. Testing

- DR restore is tested **[PLACEHOLDER — e.g. quarterly]** by restoring the latest
  backup to a staging host and verifying invoice create/send + data integrity.

---

**Confirmation:** We maintain the backup and disaster-recovery arrangements
described above for the E-Numerak platform. *(Sign + date on submission.)*

_____________________________      Date: __________
Authorised signatory, AL MERAK TAX CONSULTANT L.L.C
