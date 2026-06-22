#!/usr/bin/env bash
#
# generate_peppol_csr.sh — Generate a PEPPOL production AP private key + CSR.
#
# Usage:
#   bash scripts/generate_peppol_csr.sh <SEAT_ID> "<ORG NAME>" [OU] [COUNTRY]
#
# Example:
#   bash scripts/generate_peppol_csr.sh PAE001147 "AL MERAK TAX CONSULTANT L.L.C"
#
# Output (in certs/production/):
#   peppol-ap-prod.key  — 2048-bit RSA private key  (SECRET — never commit/email)
#   peppol-ap-prod.csr  — CSR to upload to the OpenPEPPOL CA portal
#
# The PEPPOL CA assigns the CN (Seat ID). OU is "PEPPOL AP" for production
# (the test CA issues "PEPPOL TEST AP"). RSA-2048 + SHA-256 per PEPPOL CP G3.
set -euo pipefail

SEAT_ID="${1:?Usage: generate_peppol_csr.sh <SEAT_ID> \"<ORG NAME>\" [OU] [COUNTRY]}"
ORG="${2:?Organisation (legal entity) name is required}"
OU="${3:-PEPPOL AP}"
COUNTRY="${4:-AE}"

OUT_DIR="certs/production"
KEY="$OUT_DIR/peppol-ap-prod.key"
CSR="$OUT_DIR/peppol-ap-prod.csr"

mkdir -p "$OUT_DIR"

# Owner-only permissions for any new private key material
umask 077

echo "==> Generating 2048-bit RSA private key: $KEY"
openssl genrsa -out "$KEY" 2048

echo "==> Generating CSR (SHA-256): $CSR"
openssl req -new -sha256 \
  -key "$KEY" \
  -out "$CSR" \
  -subj "/C=${COUNTRY}/O=${ORG}/OU=${OU}/CN=${SEAT_ID}"

echo "==> Verifying CSR ..."
openssl req -in "$CSR" -noout -verify
echo
echo "==> CSR subject:"
openssl req -in "$CSR" -noout -subject

cat <<EOF

Done.
  Private key : $KEY   (KEEP SECRET — do NOT commit or email)
  CSR         : $CSR   (upload this to the OpenPEPPOL CA portal)

Next: submit the CSR to OpenPEPPOL, receive the issued certificate, then build
the chain + PKCS#12 (see docs/asp-registration/02-certificate-chain-trust-proof.md).
EOF
