# Operational Support Plan

**Document:** Operational Support Plan
**Service Provider:** AL MERAK TAX CONSULTANT L.L.C (E-Numerak)
**Date:** 2026-06-23

> Fill the **[PLACEHOLDER]** contact details and support hours before submission.

---

## 1. Support channels

| Channel | Detail |
|---------|--------|
| Support email | **[PLACEHOLDER — e.g. support@e-numerak.com]** |
| Phone / WhatsApp | **[PLACEHOLDER]** |
| In-app help | Chat widget + contact form |
| Support hours | **[PLACEHOLDER — e.g. Sun–Thu, 09:00–18:00 GST; emergency on-call 24/7]** |

## 2. Support tiers & response targets

| Severity | Definition | Response | Resolution target |
|----------|------------|----------|-------------------|
| **P1 — Critical** | Platform down / cannot send or receive invoices | **[e.g. 1 hour]** | **[e.g. 4 hours]** |
| **P2 — High** | Major feature impaired (e.g. TDD reporting failing) | **[e.g. 4 hours]** | **[e.g. 1 business day]** |
| **P3 — Normal** | Minor issue / question | **[e.g. 1 business day]** | **[e.g. 3 business days]** |

## 3. Monitoring & alerting (in place)

- **Netdata** — real-time CPU/RAM/disk/container metrics.
- **Health/readiness probes** — `/health/` and `/ready/` for availability.
- **Certificate expiry monitoring** — automated alerts before AP/SMP cert expiry.
- **fail2ban** — automated intrusion alerts/bans.
- **ClamAV** — weekly malware scan with alerting on detection.
- **Logging** — application + AS4 exchange logging for traceability.

## 4. Incident management

1. **Detect** — monitoring alert or user report.
2. **Triage** — assign severity (P1–P3) and owner.
3. **Mitigate/Resolve** — apply fix; for P1, restore service first (see DR plan).
4. **Communicate** — update affected users on status and ETA.
5. **Post-incident review** — root-cause analysis for P1/P2; preventive actions.

## 5. Maintenance

- **Patching:** OS + dependency security updates applied regularly.
- **Deployments:** containerised, documented deploy workflow; changes
  version-controlled in Git.
- **Planned maintenance:** communicated in advance; scheduled in low-traffic
  windows where possible.

## 6. Escalation

| Level | Contact |
|-------|---------|
| L1 — First response | **[PLACEHOLDER — name / role]** |
| L2 — Technical lead | **[PLACEHOLDER]** |
| L3 — Vendor / PEPPOL Service Desk | servicedesk@peppol.eu |

---

**Confirmation:** We operate and support the E-Numerak platform as described.
*(Sign + date on submission.)*

_____________________________      Date: __________
Authorised signatory, AL MERAK TAX CONSULTANT L.L.C
