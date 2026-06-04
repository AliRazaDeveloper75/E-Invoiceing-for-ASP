# PINT BIS AE — v1.0.3 Schematron & code lists

**Mandatory until 7 June 2026.**

Drop the official UAE PINT-AE **1.0.3** validation artifacts here:

```
schemas/peppol/sch/1.0.3/
├── PEPPOL-EN16931-UBL.sch      ← EN 16931 / BIS core rules
└── PINT-AE.sch                 ← UAE PINT-AE 1.0.3 business rules
```

Source: https://docs.peppol.eu/poac/ae/  (or the UAE Peppol Authority / FTA portal)

The validator auto-loads this folder when `PINT_AE_VERSION=1.0.3` (the default).
If a file is missing, validation for that ruleset is gracefully skipped.
