'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { useAuth } from '@/context/AuthContext';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
    } else if (user && !user.email_verified) {
      router.replace('/verify-email');
    } else if (user?.role === 'inbound_supplier' && window.location.pathname === '/dashboard') {
      router.replace('/supplier-portal');
    }
  }, [isAuthenticated, isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin h-8 w-8 rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated || (user && !user.email_verified)) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Fixed sidebar */}
      <Sidebar />

      {/* Right column: header + scrollable content + footer */}
      <div className="flex flex-col flex-1 ml-64 min-h-screen overflow-hidden">
        {/* Top header bar */}
        <Header />

        {/* Page content — scrollable, pushed below the fixed header (h-14) */}
        <main className="flex-1 overflow-y-auto pt-14">
          <div className="max-w-7xl mx-auto px-6 py-8">
            {children}
          </div>
        </main>

        {/* Footer — always visible at the bottom */}
        <Footer />
      </div>
    </div>
  );
}
