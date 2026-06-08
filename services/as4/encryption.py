"""
PEPPOL AS4 payload encryption / decryption (WS-Security + SwA profile).

PEPPOL mandates that the invoice payload attachment is:
  1. gzip-compressed,
  2. encrypted with AES-128-GCM (a fresh symmetric key per message),
  3. the symmetric key encrypted with the recipient's RSA public key using
     RSA-OAEP (SHA-256 digest + MGF1-SHA256), and
  4. carried as a binary MIME attachment referenced by xenc:EncryptedData via
     the SwA Attachment-Ciphertext-Transform.

This module provides the crypto primitives (outbound encrypt + inbound decrypt).
The XML element construction lives in envelope.py.

XML-Encryption AES-GCM wire format (per xmlenc11 aes128-gcm):
    attachment_bytes = IV(12 bytes) || ciphertext || GCM_tag(16 bytes)
The `cryptography` AESGCM.encrypt() already appends the 16-byte tag to the
ciphertext, so we simply prepend the 12-byte IV.
"""
import gzip
import os
from dataclasses import dataclass

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# Algorithm URIs (match phase4 / PEPPOL AS4)
ALG_KEY_RSA_OAEP   = 'http://www.w3.org/2009/xmlenc11#rsa-oaep'
ALG_MGF1_SHA256    = 'http://www.w3.org/2009/xmlenc11#mgf1sha256'
ALG_DIGEST_SHA256  = 'http://www.w3.org/2001/04/xmlenc#sha256'
ALG_DATA_AES128GCM = 'http://www.w3.org/2009/xmlenc11#aes128-gcm'

GCM_IV_LEN = 12


@dataclass
class EncryptionResult:
    """Outcome of encrypting a payload for one recipient."""
    encrypted_attachment: bytes   # IV || ciphertext || tag — goes in the MIME part
    encrypted_key: bytes          # RSA-OAEP encrypted AES key — EncryptedKey CipherValue
    aes_key: bytes                # the plaintext AES key (for debugging/tests only)


def encrypt_payload(plaintext: bytes, recipient_public_key) -> EncryptionResult:
    """
    Compress + AES-128-GCM encrypt ``plaintext`` and RSA-OAEP wrap the key.

    Args:
        plaintext:            raw UBL invoice XML bytes
        recipient_public_key: the recipient AP certificate's RSA public key

    Returns:
        EncryptionResult with the encrypted attachment bytes + wrapped key.
    """
    compressed = gzip.compress(plaintext)

    aes_key = os.urandom(16)                 # AES-128
    iv = os.urandom(GCM_IV_LEN)
    ct_with_tag = AESGCM(aes_key).encrypt(iv, compressed, None)
    attachment = iv + ct_with_tag            # xmlenc aes-gcm wire format

    wrapped_key = recipient_public_key.encrypt(
        aes_key,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None,
        ),
    )
    return EncryptionResult(encrypted_attachment=attachment, encrypted_key=wrapped_key, aes_key=aes_key)


def decrypt_payload(encrypted_attachment: bytes, wrapped_key: bytes, recipient_private_key) -> bytes:
    """
    Reverse of encrypt_payload: RSA-OAEP unwrap the AES key, AES-GCM decrypt,
    then gunzip. Returns the original UBL invoice XML bytes.
    """
    aes_key = recipient_private_key.decrypt(
        wrapped_key,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None,
        ),
    )
    iv, ct_with_tag = encrypted_attachment[:GCM_IV_LEN], encrypted_attachment[GCM_IV_LEN:]
    compressed = AESGCM(aes_key).decrypt(iv, ct_with_tag, None)
    return gzip.decompress(compressed)
