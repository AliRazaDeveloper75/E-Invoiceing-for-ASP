'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { useAuth } from '@/context/AuthContext';
import { SidebarProvider, useSidebar } from '@/context/SidebarContext';
import { ChatWidget } from '@/components/chat/ChatWidget';

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50/80">
      <Sidebar />
      <div
        className="flex flex-col flex-1 min-h-screen overflow-hidden transition-all duration-300 ease-in-out"
        style={{ marginLeft: collapsed ? 68 : 256 }}
      >
        <Header />
        <main className="flex-1 overflow-y-auto pt-14">
          <div className="max-w-7xl mx-auto px-6 py-8">
            {children}
          </div>
        </main>
        <Footer />
      </div>
      <ChatWidget />
    </div>
  );
}

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
    } else if (user?.role === 'buyer') {
      router.replace('/buyer/dashboard');
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
    <SidebarProvider>
      <DashboardShell>{children}</DashboardShell>
    </SidebarProvider>
  );
}
