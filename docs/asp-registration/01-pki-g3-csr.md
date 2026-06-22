# PKI G3 Certificate Request (CSR)

**Document:** PEPPOL Production PKI (G3) Certificate Signing Request
**Service Provider:** AL MERAK TAX CONSULTANT L.L.C (E-Numerak)
**PEPPOL Seat ID (test):** PAE001147
**Date:** 2026-06-20

---

## 1. Purpose

To obtain a **production** PEPPOL Access Point certificate (PKI G3), OpenPEPPOL's
Certificate Authority (operated by DigiCert) must receive a **Certificate Signing
Request (CSR)** generated from a private key that **never leaves our server**. The
CA signs the CSR and returns the public certificate; the private key stays with us.

> We currently hold only a **test** certificate
> (`Issuer: PEPPOL ACCESS POINT TEST CA - G3`, `OU=PEPPOL TEST AP`).
> UAE accreditation requires re-passing all testbed suites with a **production**
> certificate (`Issuer: PEPPOL ACCESS POINT CA - G3`).

---

## 2. Certificate subject (Distinguished Name)

OpenPEPPOL **assigns** the Common Name (the Seat ID). For production it is the
PAE/POP seat issued to us during onboarding. The remaining fields are fixed by
the PEPPOL CA Certificate Policy:

| Field | Value | Notes |
|-------|-------|-------|
| `CN` (Common Name) | `PAE001147` *(production seat — confirm with OpenPEPPOL)* | Assigned by OpenPEPPOL |
| `O` (Organisation) | `AL MERAK TAX CONSULTANT L.L.C` | Legal entity name |
| `OU` (Org Unit) | `PEPPOL AP` | **Production** value (test uses `PEPPOL TEST AP`) |
| `C` (Country) | `AE` | ISO 3166 country code |

**Key requirements (PEPPOL CP G3):**
- Algorithm: **RSA 2048-bit** (minimum) — we use 2048.
- Signature: **SHA-256**.
- Key usage: Digital Signature + Key Encipherment (set by the CA, not the CSR).

---

## 3. How the CSR is generated (OpenSSL)

Run the helper script (added to the repo):

```bash
bash scripts/generate_peppol_csr.sh PAE001147 "AL MERAK TAX CONSULTANT L.L.C"
```

This produces, in `certs/production/`:
- `peppol-ap-prod.key` — **2048-bit RSA private key (KEEP SECRET, never email/commit)**
- `peppol-ap-prod.csr` — the CSR to upload to OpenPEPPOL

Equivalent raw OpenSSL commands (what the script does):

```bash
# 1. Generate a 2048-bit RSA private key
openssl genrsa -out peppol-ap-prod.key 2048

# 2. Generate the CSR with the PEPPOL subject DN
openssl req -new -sha256 \
  -key peppol-ap-prod.key \
  -out peppol-ap-prod.csr \
  -subj "/C=AE/O=AL MERAK TAX CONSULTANT L.L.C/OU=PEPPOL AP/CN=PAE001147"

# 3. Verify the CSR before submitting
openssl req -in peppol-ap-prod.csr -noout -text -verify
```

---

## 4. Submission flow

1. Generate key + CSR with the script above (**on the production server**, so the
   private key never travels).
2. Log into the **OpenPEPPOL onboarding / Service Metadata portal** (access given
   during enrolment by our PEPPOL Authority — for UAE this is coordinated with the
   FTA / Ministry of Finance).
3. Upload `peppol-ap-prod.csr`.
4. OpenPEPPOL CA issues the production certificate (`.cer`/`.pem`).
5. Assemble the full chain → see [02-certificate-chain-trust-proof.md](02-certificate-chain-trust-proof.md).
6. Install in the keystore and re-run all 4 PINT-AE suites.

---

## 5. Security handling of the private key

- The `.key` file is generated with `umask 077` (owner-read-only).
- It is stored under `certs/production/` which is **git-ignored** and excluded
  from backups that leave UAE.
- For runtime we package key + issued cert into a password-protected PKCS#12
  (`.pfx`) — same format as the current `certs/ap-test.p12.pfx`.
- The keystore password is supplied via environment variable
  (`PEPPOL_KEYSTORE_PASSWORD`), never hard-coded.

---

## 6. Checklist

- [ ] Confirm the **production Seat ID (CN)** with OpenPEPPOL.
- [ ] Generate key + CSR **on the production host**.
- [ ] Verify CSR subject (`openssl req -verify`).
- [ ] Upload CSR to OpenPEPPOL portal.
- [ ] Receive issued certificate.
- [ ] Build chain & PKCS#12 (next doc).
- [ ] Re-run testbed suites with production cert.
