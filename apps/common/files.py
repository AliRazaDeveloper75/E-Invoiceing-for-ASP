"""
Uploaded-file safety helpers.

Two layers of protection, applied to every user-uploaded file before it is
stored on disk:

  1. Magic-byte (file signature) verification — rejects renamed or disguised
     files (e.g. an executable or HTML file renamed to ``logo.png``) that do
     not start with the real signature of an allowed document type.

  2. ClamAV virus scan — real antivirus check. Runs only when
     ``settings.VIRUS_SCAN_ENABLED`` is ``True``. The file is streamed to the
     clamd daemon in memory and is never written to storage unless it comes
     back clean. If clamd is unreachable the upload is rejected (fail-closed)
     unless ``settings.VIRUS_SCAN_FAIL_OPEN`` is ``True``.
"""
import logging

from django.conf import settings
from rest_framework.exceptions import ValidationError

logger = logging.getLogger(__name__)

# ─── Magic byte signatures ────────────────────────────────────────────────────
# Allowed upload type -> byte signature(s) that must appear at the start of the
# file. Anything else is treated as a disguised/unsupported file and rejected.
FILE_SIGNATURES = {
    'png': (b'\x89PNG\r\n\x1a\n',),
    'jpg': (b'\xff\xd8\xff',),
    'pdf': (b'%PDF-',),
    # WebP: RIFF container + "WEBP" at offset 8 (Pillow verifies the full image)
    'webp': (b'RIFF',),
}

# Longest signature length across all types — we must read enough bytes to
# match any allowed signature (PNG is 8 bytes).
_MAX_SIG_LEN = max(len(sig) for sigs in FILE_SIGNATURES.values() for sig in sigs)


def allowed_extensions(allowed_types) -> str:
    """Human-friendly extension list, e.g. 'PNG, JPG or PDF'."""
    ext_map = {'png': 'PNG', 'jpg': 'JPG', 'jpeg': 'JPG', 'pdf': 'PDF', 'webp': 'WEBP'}
    seen = []
    for t in allowed_types:
        name = ext_map.get(t)
        if name and name not in seen:
            seen.append(name)
    return ', '.join(seen)


def verify_magic_bytes(f, allowed_types) -> bool:
    """
    Check that the file starts with the signature of one of the allowed types.

    The stream pointer is reset to 0 before returning.
    """
    if f is None:
        return False

    signatures = [sig for t in allowed_types for sig in FILE_SIGNATURES.get(t, ())]
    if not signatures:
        return True  # no signature rules configured -> nothing to verify

    f.seek(0)
    head = f.read(_MAX_SIG_LEN)
    f.seek(0)

    if not head:
        return False
    return any(head.startswith(sig) for sig in signatures)


def scan_file_for_viruses(f):
    """
    Stream an in-memory uploaded file to the ClamAV daemon.

    Raises ``rest_framework.exceptions.ValidationError`` if the file is infected
    or if scanning is enabled but the daemon is unreachable (fail-closed).
    Returns ``None`` when the file is clean or scanning is disabled.
    """
    if not getattr(settings, 'VIRUS_SCAN_ENABLED', False):
        return None

    try:
        from pyclamd import ClamdNetworkSocket  # lazy import: absent in dev
    except ImportError:
        logger.warning('pyclamd not installed — skipping ClamAV scan.')
        return None

    host = getattr(settings, 'CLAMAV_HOST', '127.0.0.1')
    port = getattr(settings, 'CLAMAV_PORT', 3310)
    timeout = getattr(settings, 'CLAMAV_TIMEOUT', 10)

    try:
        cd = ClamdNetworkSocket(host, port, timeout=timeout)
        if not cd.ping():
            raise ConnectionError('clamd ping failed')
        f.seek(0)
        data = f.read()
        f.seek(0)
        result = cd.scan_stream(data)
        if result:
            stream = result.get('stream', ())
            signature = stream[1] if isinstance(stream, (tuple, list)) and len(stream) > 1 else 'unknown'
            logger.warning('Virus scan blocked upload (signature: %s)', signature)
            raise ValidationError(
                'The file was rejected because a virus/threat was detected. '
                'No file was uploaded.'
            )
        return None
    except ValidationError:
        raise
    except Exception as exc:
        logger.exception('ClamAV scan failed: %s', exc)
        if getattr(settings, 'VIRUS_SCAN_FAIL_OPEN', False):
            logger.warning('Fail-open: allowing file despite ClamAV being unavailable.')
            return None
        raise ValidationError(
            'Uploads are temporarily unavailable — the antivirus service could '
            'not be reached. Please try again in a moment.'
        )


def validate_uploaded_file(f, allowed_types, label, max_size_mb=None):
    """
    Full validation for a single uploaded file: size limit, magic-byte type
    check, then ClamAV scan.

    Raises ``rest_framework.exceptions.ValidationError`` on any problem.
    Returns the file (with the stream reset to 0) on success.
    """
    if f is None:
        return f

    max_mb = max_size_mb or getattr(settings, 'MAX_UPLOAD_SIZE_MB', 5)
    if getattr(f, 'size', 0) and f.size > max_mb * 1024 * 1024:
        raise ValidationError(f'{label} must be {max_mb} MB or smaller.')

    if not verify_magic_bytes(f, allowed_types):
        raise ValidationError(
            f'{label} is not a valid file. Only {allowed_extensions(allowed_types)} '
            f'files are allowed.'
        )

    scan_file_for_viruses(f)
    return f
