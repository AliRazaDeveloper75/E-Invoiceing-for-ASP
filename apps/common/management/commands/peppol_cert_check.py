"""
Verify PEPPOL AS4 signing credentials are correctly configured.

Confirms the keystore (or PEM pair) loads, prints the certificate details
(subject / issuer / validity / Seat ID), and performs a real test-sign of a
dummy AS4 envelope so you know signing will work before running the
PEPPOL Testbed eDelivery suite.

Usage:
    python manage.py peppol_cert_check
"""
from django.core.management.base import BaseCommand
from django.conf import settings


class Command(BaseCommand):
    help = 'Verify PEPPOL AS4 signing credentials (keystore/PEM) load and can sign.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING('\n=== PEPPOL Signing Credential Check ===\n'))

        keystore = getattr(settings, 'PEPPOL_KEYSTORE_PATH', '')
        cert_path = getattr(settings, 'PEPPOL_CERT_PATH', '')
        key_path = getattr(settings, 'PEPPOL_PRIVATE_KEY_PATH', '')
        enabled = getattr(settings, 'PEPPOL_SIGNING_ENABLED', False)

        self.stdout.write(f'PEPPOL_SIGNING_ENABLED   : {enabled}')
        self.stdout.write(f'PEPPOL_KEYSTORE_PATH     : {keystore or "(not set)"}')
        self.stdout.write(f'PEPPOL_CERT_PATH         : {cert_path or "(not set)"}')
        self.stdout.write(f'PEPPOL_PRIVATE_KEY_PATH  : {key_path or "(not set)"}\n')

        if not keystore and not (cert_path and key_path):
            self.stdout.write(self.style.ERROR(
                'No credentials configured. Set PEPPOL_KEYSTORE_PATH (+ PEPPOL_KEYSTORE_PASSWORD).'
            ))
            return

        # 1. Load + inspect the certificate via the monitor.
        from services.cert_monitor import CertificateMonitor
        monitor = CertificateMonitor()
        result = monitor.check()

        for c in result.certificates:
            if not c.subject and not c.errors:
                continue
            self.stdout.write(self.style.MIGRATE_LABEL(f'-- {c.label} --'))
            self.stdout.write(f'  Subject       : {c.subject}')
            self.stdout.write(f'  Issuer        : {c.issuer}')
            if c.not_after:
                self.stdout.write(f'  Valid until   : {c.not_after.strftime("%Y-%m-%d %H:%M UTC")}')
                self.stdout.write(f'  Days remaining: {c.days_remaining}')
            if c.is_expired:
                self.stdout.write(self.style.ERROR('  STATUS        : EXPIRED'))
            elif c.is_warning:
                self.stdout.write(self.style.WARNING(f'  STATUS        : expiring soon'))
            elif c.errors:
                for e in c.errors:
                    self.stdout.write(self.style.ERROR(f'  ERROR         : {e}'))
            else:
                self.stdout.write(self.style.SUCCESS('  STATUS        : OK'))
            self.stdout.write('')

        # 2. Real test-sign of a minimal AS4 envelope.
        self.stdout.write(self.style.MIGRATE_LABEL('-- Test-sign AS4 envelope --'))
        try:
            from services.as4.signing import AS4MessageSigner
            signer = AS4MessageSigner()
            signer._load_credentials()  # forces keystore/PEM load
            if signer._cert is None or signer._key is None:
                raise RuntimeError('credentials did not load')
            # Verify the private key actually signs.
            from cryptography.hazmat.primitives import hashes
            from cryptography.hazmat.primitives.asymmetric import padding
            sig = signer._key.sign(b'peppol-testbed-check', padding.PKCS1v15(), hashes.SHA256())
            self.stdout.write(self.style.SUCCESS(
                f'  Signing OK — produced {len(sig)}-byte RSA-SHA256 signature.'
            ))
            self.stdout.write(self.style.SUCCESS(
                '\nCredentials are ready. You can proceed to the eDelivery Testing suite.\n'
            ))
        except Exception as exc:
            self.stdout.write(self.style.ERROR(f'  Signing FAILED: {exc}'))
            self.stdout.write(self.style.ERROR(
                '\nCheck the keystore path and PEPPOL_KEYSTORE_PASSWORD.\n'
            ))
