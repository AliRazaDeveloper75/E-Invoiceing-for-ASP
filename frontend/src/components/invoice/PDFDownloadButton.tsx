'use client';

import { useState } from 'react';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { Company, Invoice } from '@/types';

// Fetch an image URL and return a base64 data URI so @react-pdf embeds it
// reliably (avoids cross-origin fetch failures that leave the logo blank).
// Rewrites absolute /media URLs to same-origin to dodge CORS.
async function toDataUrl(url?: string | null): Promise<string | null> {
  if (!url) return null;
  let fetchUrl = url;
  try {
    const u = new URL(url, window.location.origin);
    if (u.pathname.startsWith('/media/')) fetchUrl = u.pathname; // same-origin
  } catch { /* relative already */ }
  try {
    const res = await fetch(fetchUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(typeof r.result === 'string' ? r.result : null);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function generateAndDownload(invoice: Invoice, company: Company | null) {
  const [{ pdf }, { InvoicePDF }, { createElement }, QRCodeLib] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./InvoicePDF'),
    import('react'),
    import('qrcode'),
  ]);

  // Pre-embed the company logo + customer logo as data URIs so they render.
  // Also pre-generate QR code so it's ready before PDF rendering.
  const qrText = [
    'E-NUMERAK',
    `INV:${invoice.invoice_number}`,
    `SELLER:${company?.name || invoice.company_name || ''}`,
    `STRN:${company?.trn || invoice.company_trn || ''}`,
    `BUYER:${invoice.customer_name || ''}`,
    `BTRN:${invoice.customer_trn || invoice.customer_vat_number || ''}`,
    `TOTAL:${invoice.currency} ${invoice.total_amount}`,
    `DATE:${invoice.issue_date || ''}`,
  ].join('|')
  const [companyLogo, customerLogo, qrCode] = await Promise.all([
    toDataUrl(company?.logo_url),
    toDataUrl(invoice.customer_logo),
    QRCodeLib.toDataURL(qrText, { margin: 1, width: 220, errorCorrectionLevel: 'M' }).catch(() => ''),
  ]);
  const companyForPdf: Company | null = company
    ? { ...company, logo_url: companyLogo ?? company.logo_url }
    : company;
  const invoiceForPdf: Invoice = customerLogo
    ? { ...invoice, customer_logo: customerLogo }
    : invoice;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blob = await pdf(
    createElement(InvoicePDF, { invoice: invoiceForPdf, company: companyForPdf, qrCode }) as any
  ).toBlob();

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${invoice.invoice_number}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface Props {
  invoice: Invoice;
  company: Company | null;
}

export function PDFDownloadButton({ invoice, company }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      await generateAndDownload(invoice, company);
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('PDF could not be generated. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={handleClick} loading={loading}>
      <FileText className="h-4 w-4" /> PDF
    </Button>
  );
}
