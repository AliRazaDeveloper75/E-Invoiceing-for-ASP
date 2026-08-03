'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getAccessToken } from '@/lib/api';
import { ChatWidget } from '@/components/chat/ChatWidget';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { SidebarProvider, useSidebar } from '@/context/SidebarContext';
import { CompanyProvider } from '@/hooks/useCompany';

function BuyerShell({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();

  return (
    <div dir="ltr" className="flex h-screen bg-gradient-to-br from-gray-50 to-blue-50/40 overflow-hidden">
      <Sidebar />

      {/* Main content */}
      <div className={`flex flex-col flex-1 min-w-0 transition-all duration-300 ease-in-out ${collapsed ? 'sm:ml-[68px]' : 'sm:ml-64'}`}>
        <Header />

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
            {children}
          </div>
        </main>
      </div>

      <ChatWidget />
    </div>
  );
}

export default function BuyerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) { router.push('/login'); return; }

    api.get<{ success: boolean; data: unknown }>('/buyer/me/')
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/40">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-10 h-10 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin" />
            <div className="absolute inset-0 w-10 h-10 border-[3px] border-blue-400/30 border-b-transparent rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
          </div>
          <p className="text-sm text-gray-400 animate-pulse-soft">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <CompanyProvider>
      <SidebarProvider>
        <BuyerShell>{children}</BuyerShell>
      </SidebarProvider>
    </CompanyProvider>
  );
}
