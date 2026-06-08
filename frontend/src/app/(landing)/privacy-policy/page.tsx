import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | E-Numerak',
  description:
    'How E-Numerak collects, uses, stores, and protects your data on our UAE e-invoicing platform — in line with UAE data protection requirements.',
  alternates: { canonical: '/privacy-policy' },
};

const SECTIONS: { heading: string; body: string[] }[] = [
  {
    heading: '1. Information We Collect',
    body: [
      'Account information: name, email address, phone number, and company details you provide when registering or being invited to the platform.',
      'Business data: company Tax Registration Number (TRN), customer records, invoices, line items, and supporting documents you upload (such as TRN certificates and logos).',
      'Technical data: IP address, browser type, device information, and usage logs collected automatically to operate and secure the service.',
    ],
  },
  {
    heading: '2. How We Use Your Information',
    body: [
      'To generate, validate, sign, and transmit e-invoices to the UAE Federal Tax Authority (FTA) through accredited service providers.',
      'To provide, maintain, and improve the platform, including authentication, support, and fraud prevention.',
      'To comply with legal and regulatory obligations under UAE law, including record-retention requirements.',
    ],
  },
  {
    heading: '3. Data Storage & Retention',
    body: [
      'Your data is stored on secured servers. Invoice and tax records are retained for the period required by UAE tax law (generally a minimum of 5 years).',
      'We retain personal data only for as long as necessary to provide the service and meet legal obligations, after which it is deleted or anonymised.',
    ],
  },
  {
    heading: '4. Data Sharing',
    body: [
      'We share invoice data with the FTA and accredited service providers strictly to fulfil e-invoicing obligations.',
      'We do not sell your personal data. Third-party processors (e.g. hosting, email) act only on our instructions under appropriate safeguards.',
    ],
  },
  {
    heading: '5. Security',
    body: [
      'We apply encryption in transit (HTTPS/TLS), access controls, company-scoped data isolation, and audit logging to protect your information.',
      'No method of transmission or storage is completely secure; we continuously work to safeguard your data.',
    ],
  },
  {
    heading: '6. Your Rights',
    body: [
      'You may request access to, correction of, or deletion of your personal data, subject to legal retention requirements.',
      'To exercise these rights, contact us using the details on our Contact page.',
    ],
  },
  {
    heading: '7. Changes to This Policy',
    body: [
      'We may update this Privacy Policy from time to time. Material changes will be communicated through the platform or by email.',
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <>
      <section className="bg-gradient-to-br from-[#1e3a5f] to-[#1e4080] text-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-blue-300 text-sm font-semibold uppercase tracking-widest mb-3">Legal</p>
          <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
          <p className="text-blue-100 text-lg leading-relaxed">
            Your privacy matters. This policy explains what data E-Numerak collects and how we use and protect it.
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
