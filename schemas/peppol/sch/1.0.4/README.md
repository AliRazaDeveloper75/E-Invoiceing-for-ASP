# PINT BIS AE — v1.0.4 Schematron & code lists

**Mandatory from 8 June 2026.** Includes Billing AE 1.0.4 and Self-Billing AE 1.0.4.

Drop the official UAE PINT-AE **1.0.4** validation artifacts here:

```
schemas/peppol/sch/1.0.4/
├── PEPPOL-EN16931-UBL.sch      ← EN 16931 / BIS core rules
├── PINT-AE.sch                 ← UAE PINT-AE Billing 1.0.4 business rules
└── PINT-AE-SelfBilling.sch     ← UAE PINT-AE Self-Billing 1.0.4 rules
```

Source: https://docs.peppol.eu/poac/ae/upcoming/

To activate 1.0.4, set the env var (no code change needed):

```
PINT_AE_VERSION=1.0.4
```

The validator auto-loads this folder when `PINT_AE_VERSION=1.0.4`.
If a file is missing, validation for that ruleset is gracefully skipped.
