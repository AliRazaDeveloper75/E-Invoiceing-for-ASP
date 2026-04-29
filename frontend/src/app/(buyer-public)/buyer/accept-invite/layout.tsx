import { Suspense } from 'react';

export default function AcceptInviteLayout({ children }: { children: React.ReactNode }) {
  return <Suspense>{children}</Suspense>;
}
