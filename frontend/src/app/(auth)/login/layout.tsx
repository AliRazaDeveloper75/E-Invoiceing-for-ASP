import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In',
  description:
    'Sign in to your E-Numerak account to manage UAE FTA-compliant e-invoices, submit to PEPPOL, and track buyer payments.',
  alternates: { canonical: '/login' },
  openGraph: {
    title: 'Sign In | E-Numerak',
    description: 'Access your E-Numerak e-invoicing dashboard.',
    url: '/login',
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
