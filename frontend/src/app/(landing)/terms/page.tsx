import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service | E-Numerak',
  description:
    'The terms and conditions governing your use of the E-Numerak UAE e-invoicing platform.',
  alternates: { canonical: '/terms' },
};

const SECTIONS: { heading: string; body: string[] }[] = [
  {
    heading: '1. Acceptance of Terms',
    body: [
      'By accessing or using E-Numerak ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.',
    ],
  },
  {
    heading: '2. The Service',
    body: [
      'E-Numerak is a software platform for generating, validating, signing, and transmitting e-invoices in compliance with UAE Federal Tax Authority (FTA) requirements.',
      'The Service is provided on a subscription basis and may be updated or improved over time.',
    ],
  },
  {
    heading: '3. Your Responsibilities',
    body: [
      'You are responsible for the accuracy of the data you enter, including TRNs, customer details, and invoice amounts.',
      'You must keep your account credentials confidential and are responsible for all activity under your account.',
      'You agree to use the Service only for lawful purposes and in compliance with UAE tax law.',
    ],
  },
  {
    heading: '4. Accounts & Access',
    body: [
      'Accounts are created by invitation or registration. Roles (Admin, Accountant, Viewer, Supplier) determine the actions each user may perform.',
      'We may suspend or terminate accounts that violate these terms or applicable law.',
    ],
  },
  {
    heading: '5. Fees & Payment',
    body: [
      'Subscription fees, where applicable, are billed in advance and are non-refundable except as required by law.',
      'We reserve the right to change pricing with reasonable prior notice.',
    ],
  },
  {
    heading: '6. Limitation of Liability',
    body: [
      'The Service is provided "as is". To the maximum extent permitted by law, E-Numerak is not liable for indirect, incidental, or consequential damages.',
      'You remain solely responsible for your tax filings and compliance obligations with the FTA.',
    ],
  },
  {
    heading: '7. Intellectual Property',
    body: [
      'All software, design, and content of the Service are the property of E-Numerak. Your business data remains yours.',
    ],
  },
  {
    heading: '8. Changes to These Terms',
    body: [
      'We may revise these Terms from time to time. Continued use of the Service after changes constitutes acceptance of the revised Terms.',
    ],
  },
];

export default function TermsPage() {
  return (
    <>
      <section className="bg-gradient-to-br from-[#1e3a5f] to-[#1e4080] text-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-blue-300 text-sm font-semibold uppercase tracking-widest mb-3">Legal</p>
          <h1 className="text-4xl font-bold mb-4">Terms of Service</h1>
          <p className="text-blue-100 text-lg leading-relaxed">
            Please read these terms carefully before using the E-Numerak platform.
          </p>
          <p className="text-blue-300 text-xs mt-4">Last updated: {new Date().getFullYear()}</p>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          {SECTIONS.map((s) => (
            <div key={s.heading}>
              <h2 className="text-xl font-bold text-gray-900 mb-3">{s.heading}</h2>
              <div className="space-y-2">
                {s.body.map((p, i) => (
                  <p key={i} className="text-gray-600 leading-relaxed text-sm">{p}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
