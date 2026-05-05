'use client';

import { useState } from 'react';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { Company, Invoice } from '@/types';

async function generateAndDownload(invoice: Invoice, company: Company | null) {
  const [{ pdf }, { InvoicePDF }, { createElement }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./InvoicePDF'),
    import('react'),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blob = await pdf(
    createElement(InvoicePDF, { invoice, company }) as any
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
