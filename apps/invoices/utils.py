import base64
import io

import qrcode


def generate_invoice_qr_base64(invoice):
    lines = [
        'E-NUMERAK',
        f'INV:{invoice.invoice_number}',
        f'SELLER:{invoice.company.name}',
        f'STRN:{invoice.company.trn}',
    ]
    if invoice.customer:
        lines.append(f'BUYER:{invoice.customer.name}')
        if invoice.customer.trn:
            lines.append(f'BTRN:{invoice.customer.trn}')
        elif invoice.customer.vat_number:
            lines.append(f'BTRN:{invoice.customer.vat_number}')
        else:
            lines.append('BTRN:')
    else:
        lines.append('BUYER:')
        lines.append('BTRN:')

    lines.append(f'TOTAL:{invoice.currency} {invoice.total_amount}')
    lines.append(f'DATE:{invoice.issue_date.isoformat() if invoice.issue_date else ""}')

    qr_text = '|'.join(lines)

    img = qrcode.make(qr_text, box_size=10, border=1)

    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)

    data_uri = 'data:image/png;base64,' + base64.b64encode(buf.read()).decode('ascii')
    return data_uri


def parse_invoice_faf_meta(notes: str) -> dict:
    result = {
        'permit_number': '',
        'transaction_id': '',
        'gl_account_id': '',
    }
    if not notes:
        return result
    for line in notes.split('\n'):
        line = line.strip()
        if line.startswith('Permit:'):
            result['permit_number'] = line[len('Permit:'):].strip()
        elif line.startswith('Txn ID:'):
            result['transaction_id'] = line[len('Txn ID:'):].strip()
        elif line.startswith('GL/ID:'):
            result['gl_account_id'] = line[len('GL/ID:'):].strip()
    return result
