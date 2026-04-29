import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create Account',
  description:
    'Create a free E-Numerak account and start issuing UAE FTA-compliant e-invoices via PEPPOL BIS 3.0 today.',
  alternates: { canonical: '/register' },
  openGraph: {
    title: 'Create Account | E-Numerak',
    description: 'Sign up free and start issuing UAE e-invoices in minutes.',
    url: '/register',
  },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
