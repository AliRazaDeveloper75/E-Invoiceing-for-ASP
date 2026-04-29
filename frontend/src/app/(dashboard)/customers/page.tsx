'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useCompany } from '@/hooks/useCompany';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Plus, Building2, Mail, X, Loader2, CheckCircle2 } from 'lucide-react';
import type { Customer } from '@/types';

async function fetcher(url: string) {
  const r = await api.get<{ results: Customer[]; pagination: { count: number } }>(url);
  return r.data;
}

const TYPE_LABELS: Record<string, string> = {
  b2b: 'B2B', b2g: 'B2G', b2c: 'B2C',
};

// ── Invite Buyer Modal ────────────────────────────────────────────────────────

function InviteBuyerModal({
  customer,
  onClose,
}: {
  customer: Customer;
  onClose: () => void;
}) {
  const [email, setEmail] = useState(customer.email || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/buyers/invite/', { customer_id: customer.id, email });
      setSent(true);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to send invitation.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Invite Buyer</h2>
            <p className="text-sm text-slate-500 mt-0.5">{customer.name}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {sent ? (
          <div className="px-6 py-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <p className="font-semibold text-slate-800">Invitation Sent!</p>
            <p className="text-sm text-slate-500 mt-1">
              An invite link has been sent to <strong>{email}</strong>.
            </p>
            <button
              onClick={onClose}
              className="mt-5 px-5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm font-medium text-slate-700 transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <p className="text-sm text-slate-500">
              The buyer will receive an email with a link to create their account and access invoices issued to{' '}
              <strong>{customer.name}</strong>.
            </p>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Buyer Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="buyer@company.com"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                {saving ? 'Sending…' : 'Send Invite'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const { user } = useAuth();
  const { activeId } = useCompany();
  const isAdmin = user?.role === 'admin';

  const [page, setPage] = useState(1);
  const [inviteTarget, setInviteTarget] = useState<Customer | null>(null);

  const url = isAdmin
    ? `/customers/?page=${page}`
    : activeId
      ? `/customers/?company_id=${activeId}&page=${page}`
      : null;

  const { data, isLoading } = useSWR(url, fetcher);

  const customers  = data?.results ?? [];
  const totalPages = Math.ceil((data?.pagination?.count ?? 0) / 20);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          {data && (
            <p className="text-gray-500 text-sm mt-0.5">
              {data.pagination?.count ?? 0} total{isAdmin ? ' — all companies' : ''}
            </p>
          )}
        </div>
        {!isAdmin && (
          <Link href="/customers/new">
            <Button><Plus className="h-4 w-4" /> New Customer</Button>
          </Link>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center">
            <div className="animate-spin h-6 w-6 rounded-full border-4 border-brand-600 border-t-transparent mx-auto" />
          </div>
        ) : customers.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <p className="font-medium">No customers yet</p>
            <p className="text-sm mt-1">
              {isAdmin ? 'No customers exist on the platform yet.' : 'Add your first customer to start issuing invoices.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                {isAdmin && (
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Company</th>
                )}
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">TRN</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Country</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                {!isAdmin && (
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-gray-900">{c.name}</td>
                  {isAdmin && (
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 text-gray-600 text-xs">
                        <Building2 className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        {(c as Customer & { company_name?: string }).company_name ?? '—'}
                      </div>
                    </td>
                  )}
                  <td className="px-5 py-3.5 text-gray-500 font-mono text-xs">{c.trn || '—'}</td>
                  <td className="px-5 py-3.5">
                    <Badge variant={c.customer_type === 'b2b' ? 'info' : c.customer_type === 'b2g' ? 'warning' : 'default'}>
                      {TYPE_LABELS[c.customer_type]}
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{c.country}</td>
                  <td className="px-5 py-3.5 text-gray-500">{c.email || '—'}</td>
                  {!isAdmin && (
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => setInviteTarget(c)}
                        className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                        title="Invite buyer to portal"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        Invite Buyer
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-sm">
            <span className="text-gray-500">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      {inviteTarget && (
        <InviteBuyerModal
          customer={inviteTarget}
          onClose={() => setInviteTarget(null)}
        />
      )}
    </div>
  );
}
