"""
Branded transactional email helper.

One consistent, professional header + footer and styling for EVERY outbound
email in the platform. Callers build a small HTML body and call
``send_branded_email()`` — a plain-text fallback is generated automatically and
the message is wrapped in the shared branded shell.

Usage:
    from services.emails import send_branded_email
    send_branded_email(
        subject='Welcome to E-Numerak',
        to=user.email,
        heading='Welcome aboard 👋',
        intro='Your company is now registered on E-Numerak.',
        body_html='<p>You can now issue FTA-compliant e-invoices.</p>',
        cta_label='Open Dashboard', cta_url='https://e-numerak.com/dashboard',
    )
"""
from __future__ import annotations

import logging
import re
from datetime import date

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.utils.html import strip_tags

logger = logging.getLogger(__name__)


def _brand() -> dict:
    """Brand identity pulled from settings (with safe defaults)."""
    return {
        'name':    getattr(settings, 'COMPANY_NAME', 'E-Numerak'),
        'legal':   getattr(settings, 'COMPANY_LEGAL_NAME', ''),
        'tagline': getattr(settings, 'COMPANY_TAGLINE', 'UAE FTA-Compliant E-Invoicing Platform'),
        'website': getattr(settings, 'COMPANY_WEBSITE', getattr(settings, 'FRONTEND_URL', '')),
        'support': getattr(settings, 'SUPPORT_EMAIL', 'support@e-numerak.com'),
        'address': getattr(settings, 'COMPANY_ADDRESS', 'Dubai, United Arab Emirates'),
        'color':   getattr(settings, 'BRAND_PRIMARY_COLOR', '#1e3a5f'),
        'accent':  getattr(settings, 'BRAND_ACCENT_COLOR', '#2563eb'),
        'from':    getattr(settings, 'DEFAULT_FROM_EMAIL', 'E-Numerak <no-reply@e-numerak.com>'),
        'year':    date.today().year,
    }


def render_branded_email(
    *,
    heading: str,
    body_html: str,
    intro: str = '',
    cta_label: str = '',
    cta_url: str = '',
    preheader: str = '',
) -> str:
    """Wrap content in the shared, email-client-safe branded HTML shell."""
    b = _brand()

    intro_block = (
        f'<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">{intro}</p>'
        if intro else ''
    )

    cta_block = ''
    if cta_label and cta_url:
        cta_block = f"""
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
            <tr><td style="border-radius:8px;background:{b['color']};">
              <a href="{cta_url}" target="_blank"
                 style="display:inline-block;padding:13px 30px;font-size:15px;font-weight:600;
                        color:#ffffff;text-decoration:none;border-radius:8px;">{cta_label}</a>
            </td></tr>
          </table>
          <p style="margin:8px 0 0;font-size:12px;color:#94a3b8;line-height:1.5;">
            If the button doesn't work, copy this link into your browser:<br>
            <a href="{cta_url}" style="color:{b['accent']};word-break:break-all;">{cta_url}</a>
          </p>"""

    preheader_block = (
        f'<div style="display:none;max-height:0;overflow:hidden;opacity:0;">{preheader}</div>'
        if preheader else ''
    )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <title>{heading}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;
             font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  {preheader_block}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0"
             style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;
                    box-shadow:0 1px 3px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:{b['color']};padding:26px 32px;">
            <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">{b['name']}</span>
            <span style="display:block;margin-top:3px;font-size:12px;color:#cbd5e1;">{b['tagline']}</span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0f172a;">{heading}</h1>
            {intro_block}
            <div style="font-size:15px;line-height:1.6;color:#334155;">{body_html}</div>
            {cta_block}
          </td>
        </tr>

        <!-- Divider -->
        <tr><td style="padding:0 32px;"><div style="border-top:1px solid #e2e8f0;"></div></td></tr>

        <!-- Footer -->
        <tr>
          <td style="padding:22px 32px 28px;">
            <p style="margin:0 0 6px;font-size:13px;color:#475569;font-weight:600;">{b['name']}{(' — ' + b['legal']) if b['legal'] else ''}</p>
            <p style="margin:0 0 10px;font-size:12px;color:#94a3b8;line-height:1.6;">
              {b['address']}<br>
              Need help? <a href="mailto:{b['support']}" style="color:{b['accent']};text-decoration:none;">{b['support']}</a>
              &nbsp;·&nbsp;
              <a href="{b['website']}" style="color:{b['accent']};text-decoration:none;">{b['website']}</a>
            </p>
            <p style="margin:0;font-size:11px;color:#cbd5e1;">
              FTA Certified · BIS 3.0 · UBL 2.1 · VAT Compliant<br>
              © {b['year']} {b['name']}. This is an automated message — please do not reply directly.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def _auto_text(intro: str, body_html: str, cta_label: str = '', cta_url: str = '') -> str:
    """Generate a readable plain-text fallback from the HTML body."""
    text = re.sub(r'<\s*br\s*/?>', '\n', body_html, flags=re.I)
    text = re.sub(r'</\s*(p|div|tr|h[1-6]|li)\s*>', '\n', text, flags=re.I)
    text = strip_tags(text)
    text = re.sub(r'\n{3,}', '\n\n', text).strip()
    parts = []
    if intro:
        parts.append(intro.strip())
    parts.append(text)
    if cta_label and cta_url:
        parts.append(f'{cta_label}: {cta_url}')
    return '\n\n'.join(p for p in parts if p)


def send_branded_email(
    *,
    subject: str,
    to,
    heading: str,
    body_html: str,
    intro: str = '',
    cta_label: str = '',
    cta_url: str = '',
    preheader: str = '',
    text_body: str | None = None,
    attachments: list | None = None,
    reply_to: str | None = None,
    fail_silently: bool = True,
) -> bool:
    """
    Send a transactional email wrapped in the branded shell.

    ``to`` may be a single address or a list. ``attachments`` is a list of
    (filename, content, mimetype) tuples. Returns True on success.
    """
    b = _brand()
    html = render_branded_email(
        heading=heading, body_html=body_html, intro=intro,
        cta_label=cta_label, cta_url=cta_url, preheader=preheader,
    )
    if text_body is None:
        text_body = _auto_text(intro, body_html, cta_label, cta_url)

    recipients = [to] if isinstance(to, str) else list(to)
    msg = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=b['from'],
        to=recipients,
        reply_to=[reply_to] if reply_to else None,
    )
    msg.attach_alternative(html, 'text/html')
    for att in (attachments or []):
        msg.attach(*att)

    try:
        msg.send(fail_silently=False)
        return True
    except Exception as exc:
        logger.exception('Branded email send failed (%s): %s', subject, exc)
        if not fail_silently:
            raise
        return False
