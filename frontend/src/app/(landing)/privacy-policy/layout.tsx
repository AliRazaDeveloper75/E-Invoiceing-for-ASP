import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | E-Numerak UAE E-Invoicing',
  description:
    'E-Numerak Privacy Policy — learn how we collect, use, store, and protect your data in compliance with UAE data protection regulations and FTA requirements.',
  keywords: [
    'E-Numerak privacy policy',
    'UAE e-invoicing data protection',
    'E-Invoice platform privacy',
    'FTA tax data security UAE',
    'UAE data privacy compliance',
  ],
  alternates: { canonical: '/privacy-policy' },
  openGraph: {
    title: 'Privacy Policy | E-Numerak UAE E-Invoicing',
    description:
      'E-Numerak Privacy Policy — learn how we collect, use, store, and protect your data in compliance with UAE data protection regulations.',
    url: '/privacy-policy',
  },
};

export default function PrivacyPolicyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
