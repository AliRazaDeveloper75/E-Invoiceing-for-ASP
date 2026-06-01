#!/usr/bin/env bash
# Download official PEPPOL BIS 3.0 XSD + Schematron schema files.
#
# Run from the project root:
#   bash scripts/download_schemas.sh
#
# Requires: curl, unzip

set -euo pipefail

SCHEMA_DIR="$(dirname "$0")/../schemas/peppol"
XSD_DIR="$SCHEMA_DIR/xsd"
SCH_DIR="$SCHEMA_DIR/sch"
TMP_DIR="/tmp/peppol_schemas_$$"

mkdir -p "$XSD_DIR/common" "$SCH_DIR" "$TMP_DIR"

echo "==> Downloading OASIS UBL 2.1 XSD schemas..."
# Official OASIS UBL 2.1 schema package
UBL_ZIP_URL="https://docs.oasis-open.org/ubl/os-UBL-2.1/UBL-2.1.zip"
curl -fsSL "$UBL_ZIP_URL" -o "$TMP_DIR/UBL-2.1.zip"

echo "==> Extracting UBL 2.1 XSD..."
unzip -q "$TMP_DIR/UBL-2.1.zip" -d "$TMP_DIR/ubl"

# Copy the invoice/creditnote root schemas
cp "$TMP_DIR/ubl/xsd/maindoc/UBL-Invoice-2.1.xsd"    "$XSD_DIR/"
cp "$TMP_DIR/ubl/xsd/maindoc/UBL-CreditNote-2.1.xsd" "$XSD_DIR/"

# Copy all common schemas
cp "$TMP_DIR/ubl/xsd/common/"*.xsd "$XSD_DIR/common/"

echo "==> Downloading PEPPOL BIS 3.0 Schematron rules..."
# PEPPOL BIS Billing 3.0 — latest release
BIS_URL="https://github.com/OpenPEPPOL/peppol-bis-invoice-3/releases/latest/download/peppol-bis-invoice-3-validation.zip"
curl -fsSL "$BIS_URL" -o "$TMP_DIR/bis3.zip" || {
    echo "WARN: BIS 3.0 download failed — check https://github.com/OpenPEPPOL/peppol-bis-invoice-3/releases"
    echo "WARN: Download manually and place PEPPOL-EN16931-UBL.sch in $SCH_DIR/"
}

if [ -f "$TMP_DIR/bis3.zip" ]; then
    unzip -q "$TMP_DIR/bis3.zip" -d "$TMP_DIR/bis3"
    # The .sch file may be in various subdirectories depending on the release
    find "$TMP_DIR/bis3" -name "*.sch" -exec cp {} "$SCH_DIR/" \;
fi

echo "==> PINT-AE rules..."
echo "NOTE: PINT-AE.sch is not yet published. When the UAE FTA releases it,"
echo "      place it at: $SCH_DIR/PINT-AE.sch"

# Cleanup
rm -rf "$TMP_DIR"

echo ""
echo "Done. Schema files:"
echo "  XSD:       $XSD_DIR"
echo "  Schematron: $SCH_DIR"
echo ""
echo "Set PEPPOL_XSD_VALIDATION_ENABLED=True in .env to activate validation."
