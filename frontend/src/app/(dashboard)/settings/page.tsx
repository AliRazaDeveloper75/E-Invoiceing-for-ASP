'use client';

import { useAuth } from '@/context/AuthContext';
import { Bell, Shield, Globe } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="max-w-2xl mx-auto space-y-8 p-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Account info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-gray-500" />
          <h2 className="font-semibold text-gray-900">Account</h2>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Email</span>
            <span className="text-gray-900 font-medium">{user?.email}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Role</span>
            <span className="text-gray-900 font-medium capitalize">{user?.role?.replace(/_/g, ' ')}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Email verified</span>
            <span className={user?.email_verified ? 'text-green-600 font-medium' : 'text-amber-600 font-medium'}>
              {user?.email_verified ? 'Verified' : 'Not verified'}
            </span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-gray-500">Member since</span>
            <span className="text-gray-900 font-medium">
              {user?.date_joined ? new Date(user.date_joined).toLocaleDateString() : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Notifications placeholder */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-gray-500" />
          <h2 className="font-semibold text-gray-900">Notifications</h2>
        </div>
        <p className="text-sm text-gray-400">Notification preferences coming soon.</p>
      </div>

      {/* Region placeholder */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-gray-500" />
          <h2 className="font-semibold text-gray-900">Region &amp; Language</h2>
        </div>
        <p className="text-sm text-gray-400">UAE / English (default)</p>
      </div>
    </div>
  );
}
