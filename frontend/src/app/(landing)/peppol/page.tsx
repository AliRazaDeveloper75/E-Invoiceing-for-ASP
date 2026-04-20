import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

const CORNERS = [
  {
    num: 1,
    label: 'Supplier / ERP',
    desc: 'The invoice originator. Your business creates and digitally signs the PEPPOL UBL 2.1 XML invoice document.',
    color: 'bg-blue-600',
    tag: 'Your System',
  },
  {
    num: 2,
    label: 'Accredited Service Provider (ASP)',
    desc: 'The supplier\'s ASP receives the XML, validates it against PEPPOL rules, and transmits it to the FTA network.',
    color: 'bg-indigo-600',
    tag: 'ASP / Corner 2',
  },
  {
    num: 3,
    label: 'FTA / PEPPOL Network',
    desc: 'UAE Federal Tax Authority acts as the central hub — receiving, archiving, and routing invoices between corners.',
    color: 'bg-purple-600',
    tag: 'FTA Network',
  },
  {
    num: 4,
    label: 'Buyer',
    desc: 'The invoice recipient (business or government entity). They receive the validated e-invoice through their ASP.',
    color: 'bg-emerald-600',
    tag: 'Buyer / Corner 4',
  },
  {
    num: 5,
    label: 'Buyer\'s ASP',
    desc: 'The buyer\'s accredited service provider delivers and archives the invoice for the receiving entity.',
    color: 'bg-teal-600',
    tag: 'Receiving ASP',
  },
];

const UBL_ELEMENTS = [
  { element: 'cbc:ID',                     desc: 'Invoice number (auto-generated)' },
  { element: 'cbc:IssueDate',              desc: 'Invoice date (YYYY-MM-DD)' },
  { element: 'cbc:InvoiceTypeCode',        desc: '380 (Tax), 381 (Credit Note), 480 (Commercial)' },
  { element: 'cbc:DocumentCurrencyCode',   desc: 'AED / USD / EUR' },
  { element: 'cac:AccountingSupplierParty',desc: 'Supplier — name, TRN, address' },
  { element: 'cac:AccountingCustomerParty',desc: 'Buyer — name, TRN, address' },
  { element: 'cac:TaxTotal',              desc: 'Total VAT with per-category breakdown' },
  { element: 'cac:LegalMonetaryTotal',    desc: 'Subtotal, taxable amount, grand total' },
  { element: 'cac:InvoiceLine',           desc: 'Line items — description, qty, price, VAT' },
  { element: 'cac:InvoicePeriod',         desc: 'Supply period (continuous supplies only)' },
];

export default function PeppolPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#1e3a5f] to-[#1e4080] text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-blue-300 text-sm font-semibold uppercase tracking-widest mb-3">PEPPOL Framework</p>
            <h1 className="text-4xl font-bold mb-4">The PEPPOL 5-Corner Model</h1>
            <p className="text-blue-100 text-lg leading-relaxed">
              UAE&apos;s mandatory e-invoicing infrastructure is built on the PEPPOL network —
              a secure, standardised way to exchange electronic business documents.
            </p>
          </div>
        </div>
      </section>

      {/* 5 Corners */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">How the 5 Corners Work</h2>
          <p className="text-gray-500 text-sm mb-12 max-w-2xl">
            The UAE FTA uses the PEPPOL 5-corner model to route e-invoices from the supplier to the buyer through certified intermediaries.
          </p>

          {/* Flow diagram */}
          <div className="flex flex-col lg:flex-row items-center lg:items-start gap-4 mb-16">
            {CORNERS.map((corner, i) => (
              <div key={corner.num} className="flex lg:flex-col items-start lg:items-center gap-4 flex-1 min-w-0">
                <div className="flex flex-col lg:flex-row items-center gap-3 lg:gap-0 w-full">
                  <div className={`flex items-center justify-center w-12 h-12 rounded-full ${corner.color} text-white font-bold text-lg shrink-0`}>
                    {corner.num}
                  </div>
                  {i < CORNERS.length - 1 && (
                    <div className="hidden lg:block flex-1 h-0.5 bg-gray-200 mx-2" />
                  )}
                </div>
                <div className="lg:text-center mt-2 lg:mt-4">
                  <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full text-white mb-1 ${corner.color}`}>
                    {corner.tag}
                  </span>
                  <h3 className="font-semibold text-gray-900 text-sm mb-1">{corner.label}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{corner.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Our position */}
          <div className="rounded-2xl bg-[#1e3a5f] text-white p-8">
            <h3 className="font-bold text-lg mb-3">Where Our Platform Sits</h3>
            <p className="text-blue-100 text-sm leading-relaxed mb-4">
              We operate as <strong>Corner 1</strong> — the supplier-side system that creates, validates, and
              packages your invoice into PEPPOL UBL 2.1 XML format.
              Our integration layer (Corner 2 ASP) handles submission to the FTA network.
              Currently using a MockASPClient for development; switch to a real UAE-accredited ASP for production.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'Corner 1', val: 'Our Platform', color: 'bg-blue-500' },
                { label: 'Corner 2', val: 'ASP Integration', color: 'bg-indigo-500' },
                { label: 'Corner 5', val: 'FTA Network', color: 'bg-purple-500' },
              ].map((c) => (
                <div key={c.label} className="flex items-center gap-3 bg-white/10 rounded-xl p-4">
                  <div className={`w-8 h-8 rounded-full ${c.color} flex items-center justify-center text-white text-xs font-bold`}>
                    {c.label.split(' ')[1]}
                  </div>
                  <div>
                    <p className="text-xs text-blue-300">{c.label}</p>
                    <p className="text-sm font-semibold">{c.val}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* UBL XML */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">UBL 2.1 XML Elements Generated</h2>
          <p className="text-gray-500 text-sm mb-8">Every invoice generates a fully compliant PEPPOL BIS Billing 3.0 XML document including:</p>
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1e3a5f] text-white">
                  <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider">UBL Element</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider">Description</th>
                </tr>
              </thead>
              <tbody>
                {UBL_ELEMENTS.map((row, i) => (
                  <tr key={row.element} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-3 font-mono text-xs text-blue-700">{row.element}</td>
                    <td className="px-6 py-3 text-gray-600 text-xs">{row.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-white border-t border-gray-100 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">See It in Action</h2>
        <p className="text-gray-500 mb-8">Create an invoice and download the UBL XML right from the portal.</p>
        <Link href="/dashboard" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1e3a5f] hover:bg-[#172f4d] text-white font-semibold text-sm transition-colors">
          E-Invoice Portal <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </>
  );
}
