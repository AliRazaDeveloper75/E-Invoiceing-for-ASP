# phoss SMP deployment — E-Numerak (UAE PINT-AE, TEST)

Self-hosted Peppol SMP using the official **phoss-smp-xml** Docker image.

- Domain: `smp.e-numerak.com` → `187.127.231.215`
- SMP cert: G3 SMP TEST (`CN=PAE001138`), packaged as `smp-keystore.p12` (alias `smp`)
- Participant under test: `0235:104132266800003`

## 1. Lay out files on the server

```bash
mkdir -p /opt/smp/config
cp /root/smp-keystore.p12 /opt/smp/config/
# copy application.properties + docker-compose.smp.yml into place (see this folder)
```

Edit `/opt/smp/config/application.properties` and set the keystore password
(`CHANGE_ME_P12_PASSWORD` → the export password you set).

## 2. Start the SMP container

```bash
cd /opt/smp
docker compose -f docker-compose.smp.yml up -d
docker logs -f phoss-smp     # watch startup; should report keystore loaded OK
```

The app listens on `127.0.0.1:8888` (proxied by nginx next).

## 3. HTTPS via nginx + Let's Encrypt

```bash
apt-get update && apt-get install -y nginx certbot python3-certbot-nginx
mkdir -p /var/www/certbot
cp nginx-smp.conf /etc/nginx/sites-available/smp.e-numerak.com
ln -s /etc/nginx/sites-available/smp.e-numerak.com /etc/nginx/sites-enabled/
certbot --nginx -d smp.e-numerak.com         # issues + installs the TLS cert
nginx -t && systemctl reload nginx
```

Verify: open `https://smp.e-numerak.com/` → phoss SMP UI loads.

## 4. Log in + register to the SMK (test SML)

- Default login: `admin@helger.com` / `password` → **change immediately**.
- UI → SML configuration → select **Peppol SMK [Test]** → **Register SMP to SML**
  (authenticates with the SMP keystore cert).
- After success, set `sml.enabled = true` in application.properties and restart.

## 5. Register the participant + capabilities

Service Group: `iso6523-actorid-upis::0235:104132266800003`

Add 4 endpoints (Process `cenbii-procid-ubl::urn:peppol:bis:billing` for the first
three; `cenbii-procid-ubl::urn:peppol:edec:mls` for MLS). Transport profile
`peppol-transport-as4-v2_0`, endpoint URL = your **Access Point** AS4 URL, cert =
your **AP** certificate.

Document types:
```
peppol-doctype-wildcard::urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:peppol:pint:billing-1@ae-1*::2.1
peppol-doctype-wildcard::urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2::CreditNote##urn:peppol:pint:billing-1@ae-1*::2.1
busdox-docid-qns::urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2::ApplicationResponse##urn:peppol:edec:mls:1.0::2.1
```

## 6. Verify + run the testbed

```bash
curl https://smp.e-numerak.com/0235:104132266800003   # should list the capabilities
```
Then run the PINT-AE Billing test suite (12 cases) on the Peppol Testbed.
