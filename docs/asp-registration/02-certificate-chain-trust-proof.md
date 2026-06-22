# Certificate Chain / Trust Proof

**Document:** PEPPOL AP Certificate Chain & Trust Validation
**Service Provider:** AL MERAK TAX CONSULTANT L.L.C (E-Numerak)
**Date:** 2026-06-20

---

## 1. Purpose

Demonstrate that our Access Point certificate chains up to a trusted PEPPOL root,
and that our AP **validates** the trust chain (and revocation status) of every
remote certificate before transmitting or accepting a message. This is the
"trust proof" required for ASP registration.

---

## 2. The PEPPOL G3 trust chain

A PEPPOL AP certificate is a 3-level chain:

```
PEPPOL Root CA - G3                         (root, self-signed)
   └── PEPPOL ACCESS POINT CA - G3          (intermediate, issuing CA)
          └── CN=PAE001147 (our AP cert)    (leaf / end-entity)
```

- **Test** chain issuer: `PEPPOL ACCESS POINT TEST CA - G3` ("FOR TEST ONLY").
- **Production** chain issuer: `PEPPOL ACCESS POINT CA - G3`.

Our current leaf (test):

| Field | Value |
|-------|-------|
| Subject | `CN=PAE001147, OU=PEPPOL TEST AP, O=AL MERAK TAX CONSULTANT L.L.C, C=AE` |
| Issuer | `CN=PEPPOL ACCESS POINT TEST CA - G3, OU=FOR TEST ONLY, O=OpenPEPPOL AISBL, C=BE` |
| Not After | 2028-05-20 |

---

## 3. Assembling the chain (after issuance)

Once OpenPEPPOL returns the issued leaf certificate:

```bash
# 1. Convert the issued cert to PEM (if returned as DER/.cer)
openssl x509 -inform DER -in peppol-ap-prod.cer -out leaf.pem   # skip if already PEM

# 2. Build the full-chain file: leaf -> intermediate -> root
cat leaf.pem peppol-ap-ca-g3.pem peppol-root-ca-g3.pem > peppol-ap-prod-fullchain.pem

# 3. Verify the chain end-to-end
openssl verify -CAfile peppol-root-ca-g3.pem \
  -untrusted peppol-ap-ca-g3.pem leaf.pem
# expected: leaf.pem: OK

# 4. Package key + chain into a PKCS#12 for the runtime keystore
openssl pkcs12 -export \
  -inkey certs/production/peppol-ap-prod.key \
  -in leaf.pem \
  -certfile peppol-ap-ca-g3.pem \
  -out certs/production/ap-prod.p12.pfx \
  -name "peppol-ap-prod"
```

The PEPPOL intermediate + root certificates are published by OpenPEPPOL and are
already bundled in our trust store (see §4).

---

## 4. How our AP proves trust (code)

Trust/revocation validation is implemented in
[services/as4/cert_validation.py](../../services/as4/cert_validation.py), with the
bundled PEPPOL anchors in `services/as4/trust_anchors/`.

**Outbound (before we send):** the recipient AP certificate returned by SMP is
validated by `validate_recipient_cert()` — chain build to a bundled PEPPOL anchor
**and** CRL revocation check. If it fails, the message is **not transmitted**.
This was certified in the eDelivery testbed (TC2A.4, invalid-cert handling) and
the PINT-AE Business Document Validation suites — see the batch summary lines
`REJECTED-INVALID-CERT`.

**Inbound (before we accept):** the signer certificate on a received AS4 message
is run through the same chain/revocation gate (controlled by
`PEPPOL_AS4_VERIFY_SIGNER_TRUST`). Untrusted signers are rejected — certified in
the PKI G3 suite (invalid-cert reception).

**Evidence already on file:**
- `TestBedReport-PAE001147-20260609T122213.pdf` — eDelivery Standalone AP 6/6 (incl. TC2A.4).
- `TestBedReport-PAE001147-20260609T135555.pdf` — PKI G3 suite 3/3 (valid + invalid cert).

---

## 5. Checklist

- [ ] Receive issued production leaf certificate from OpenPEPPOL.
- [ ] Download PEPPOL production intermediate + root (G3).
- [ ] Build & `openssl verify` the full chain (must say `OK`).
- [ ] Confirm leaf public key matches `peppol-ap-prod.key` (modulus check).
- [ ] Export password-protected PKCS#12 for the keystore.
- [ ] Add production anchors to `services/as4/trust_anchors/` if not present.

```bash
# Modulus match check (leaf cert vs our private key) — both hashes must be equal
openssl x509 -noout -modulus -in leaf.pem | openssl md5
openssl rsa  -noout -modulus -in certs/production/peppol-ap-prod.key | openssl md5
```
