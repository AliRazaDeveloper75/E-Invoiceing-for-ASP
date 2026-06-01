# PEPPOL BIS 3.0 Schema Files

This directory holds the official XSD and Schematron files required for
PEPPOL BIS Billing 3.0 invoice validation.

## Directory Layout

```
schemas/peppol/
├── xsd/
│   ├── UBL-Invoice-2.1.xsd              ← root schema (Invoice)
│   ├── UBL-CreditNote-2.1.xsd           ← root schema (CreditNote)
│   └── common/
│       ├── UBL-CommonAggregateComponents-2.1.xsd
│       ├── UBL-CommonBasicComponents-2.1.xsd
│       ├── UBL-CommonExtensionComponents-2.1.xsd
│       ├── UBL-UnqualifiedDataTypes-2.1.xsd
│       ├── UBL-QualifiedDataTypes-2.1.xsd
│       └── ...
└── sch/
    ├── PEPPOL-EN16931-UBL.sch           ← BIS 3.0 business rules
    └── PINT-AE.sch                      ← UAE PINT-AE rules (when published)
```

## How to Download

Run the download script (requires `curl`):

```bash
bash scripts/download_schemas.sh
```

Or manually:

| File | Source |
|------|--------|
| UBL 2.1 XSD schemas | https://docs.oasis-open.org/ubl/os-UBL-2.1/xsd/ |
| PEPPOL BIS 3.0 Schematron | https://github.com/OpenPEPPOL/peppol-bis-invoice-3/releases |
| PINT-AE extension | UAE ASP / FTA portal (when published) |

## Notes

- XSD validation is **gracefully skipped** if files are absent
  (`PEPPOL_XSD_VALIDATION_ENABLED=False` or files not yet downloaded)
- Set `PEPPOL_XSD_VALIDATION_ENABLED=False` in `.env` for local dev
  if you don't need strict schema validation during development
