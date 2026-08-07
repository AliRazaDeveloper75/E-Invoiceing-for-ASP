"""
apps.common.files tests.

Covers the two upload-safety layers:
- magic-byte (file signature) verification
- ClamAV virus scan (ClamAV daemon mocked out)
"""
from unittest import mock

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, override_settings
from rest_framework.exceptions import ValidationError

from .files import (
    allowed_extensions,
    verify_magic_bytes,
    validate_uploaded_file,
)


def make_file(content, name='upload.bin', content_type='application/octet-stream'):
    return SimpleUploadedFile(name, content, content_type=content_type)


REAL_PNG = b'\x89PNG\r\n\x1a\n' + b'fake-remainder'
REAL_JPG = b'\xff\xd8\xff\xe0' + b'fake-remainder'
REAL_PDF = b'%PDF-1.4\nfake' + b'remainder'
FAKE_PNG = b'not-really-a-png'          # correct extension, wrong bytes
REAL_WEBP = b'RIFF' + b'\x00' * 4 + b'WEBP' + b'rest'


class AllowedExtensionsTest(SimpleTestCase):

    def test_maps_and_dedupes(self):
        self.assertEqual(allowed_extensions(['png', 'jpg', 'jpeg']), 'PNG, JPG')
        self.assertEqual(allowed_extensions(['pdf', 'jpg', 'jpeg', 'png']), 'PDF, JPG, PNG')
        self.assertEqual(allowed_extensions(['webp']), 'WEBP')

    def test_unknown_types_ignored(self):
        self.assertEqual(allowed_extensions(['docx']), '')


class VerifyMagicBytesTest(SimpleTestCase):

    def test_png_accepts_real_png(self):
        self.assertTrue(verify_magic_bytes(make_file(REAL_PNG), ['png']))

    def test_png_rejects_fake_png(self):
        self.assertFalse(verify_magic_bytes(make_file(FAKE_PNG), ['png']))

    def test_exe_disguised_as_png_rejected(self):
        self.assertFalse(verify_magic_bytes(make_file(b'MZ\x90\x00exe-bytes', 'virus.exe.png'), ['png']))

    def test_jpg_png_both_accepted(self):
        self.assertTrue(verify_magic_bytes(make_file(REAL_JPG), ['png', 'jpg']))

    def test_pdf_rejected_for_image_types(self):
        self.assertFalse(verify_magic_bytes(make_file(REAL_PDF), ['png', 'jpg']))

    def test_stream_pointer_reset_after_check(self):
        f = make_file(REAL_PNG)
        verify_magic_bytes(f, ['png'])
        self.assertEqual(f.tell(), 0)

    def test_webp(self):
        self.assertTrue(verify_magic_bytes(make_file(REAL_WEBP), ['webp']))

    def test_no_signature_rules_allows(self):
        self.assertTrue(verify_magic_bytes(make_file(FAKE_PNG), ['unknown']))

    def test_none_file_rejected(self):
        self.assertFalse(verify_magic_bytes(None, ['png']))


class ValidateUploadedFileTest(SimpleTestCase):

    @override_settings(MAX_UPLOAD_SIZE_MB=5)
    def test_oversize_rejected(self):
        big = make_file(b'x' * (5 * 1024 * 1024 + 1), name='big.png', content_type='image/png')
        with self.assertRaises(ValidationError):
            validate_uploaded_file(big, ['png'], 'Logo')

    @override_settings(MAX_UPLOAD_SIZE_MB=5)
    def test_wrong_magic_bytes_rejected(self):
        with self.assertRaises(ValidationError):
            validate_uploaded_file(make_file(FAKE_PNG, 'logo.png', 'image/png'), ['png'], 'Logo')

    @override_settings(MAX_UPLOAD_SIZE_MB=5)
    def test_valid_png_passes(self):
        result = validate_uploaded_file(make_file(REAL_PNG, 'logo.png', 'image/png'), ['png'], 'Logo')
        self.assertIsNotNone(result)
        self.assertEqual(result.tell(), 0)

    @override_settings(VIRUS_SCAN_ENABLED=True, VIRUS_SCAN_FAIL_OPEN=False, CLAMAV_HOST='127.0.0.1', CLAMAV_PORT=3310, CLAMAV_TIMEOUT=1)
    def test_infected_file_rejected(self):
        fake_cd = mock.Mock()
        fake_cd.ping.return_value = True
        fake_cd.scan_stream.return_value = {'stream': ('FOUND', 'Eicar-Test-Signature')}
        with mock.patch('pyclamd.ClamdNetworkSocket', return_value=fake_cd):
            with self.assertRaisesMessage(ValidationError, 'virus/threat was detected'):
                validate_uploaded_file(make_file(REAL_PNG, 'logo.png', 'image/png'), ['png'], 'Logo')

    @override_settings(VIRUS_SCAN_ENABLED=True, VIRUS_SCAN_FAIL_OPEN=False, CLAMAV_HOST='127.0.0.1', CLAMAV_PORT=3310, CLAMAV_TIMEOUT=1)
    def test_unreachable_daemon_fails_closed(self):
        with mock.patch('pyclamd.ClamdNetworkSocket', side_effect=ConnectionError('refused')):
            with self.assertRaisesMessage(ValidationError, 'antivirus service'):
                validate_uploaded_file(make_file(REAL_PNG, 'logo.png', 'image/png'), ['png'], 'Logo')

    @override_settings(VIRUS_SCAN_ENABLED=True, VIRUS_SCAN_FAIL_OPEN=True, CLAMAV_HOST='127.0.0.1', CLAMAV_PORT=3310, CLAMAV_TIMEOUT=1)
    def test_unreachable_daemon_fails_open_when_configured(self):
        with mock.patch('pyclamd.ClamdNetworkSocket', side_effect=ConnectionError('refused')):
            result = validate_uploaded_file(make_file(REAL_PNG, 'logo.png', 'image/png'), ['png'], 'Logo')
        self.assertIsNotNone(result)

    @override_settings(VIRUS_SCAN_ENABLED=False)
    def test_scan_skipped_when_disabled(self):
        with mock.patch('pyclamd.ClamdNetworkSocket') as cd:
            result = validate_uploaded_file(make_file(REAL_PNG, 'logo.png', 'image/png'), ['png'], 'Logo')
        self.assertIsNotNone(result)
        cd.assert_not_called()
