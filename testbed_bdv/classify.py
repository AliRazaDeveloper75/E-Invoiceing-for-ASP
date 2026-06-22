"""Dry-classify the BDV test files: which pass PINT-AE Schematron, which fail."""
import os, sys, glob, django
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from services.peppol.mls import parse_received_sbd
from services.peppol.pint_ae.xslt_validator import validate_document

HERE = os.path.dirname(os.path.abspath(__file__))
files = sorted(glob.glob(os.path.join(HERE, 'TestFile_*.xml')))
for f in files:
    payload = open(f, 'rb').read()
    info = parse_received_sbd(payload)
    name = os.path.basename(f)
    if not info.business_doc:
        print(f'{name:38s} NO-BUSINESS-DOC')
        continue
    profile = 'billing'
    vd = validate_document(info.business_doc, profile=profile)
    if not vd.ran:
        print(f'{name:38s} VALIDATION-DID-NOT-RUN')
    elif vd.is_valid:
        print(f'{name:38s} VALID  -> will SEND')
    else:
        ids = ', '.join(sorted({e.get("id") or "?" for e in vd.errors}))
        print(f'{name:38s} INVALID ({len(vd.errors)} err) -> will GATE   [{ids}]')
