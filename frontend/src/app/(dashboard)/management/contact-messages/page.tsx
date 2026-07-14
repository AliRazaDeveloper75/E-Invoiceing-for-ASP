'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { MessageSquare, Mail, Phone, Building2, RefreshCw, CheckCircle2, Eye, Reply, Trash2, Search } from 'lucide-react';
import CustomSelect from '@/components/ui/CustomSelect';

async function fetcher(url: string) {
  const r = await api.get(url);
  return r.data.data;
}

interface ContactMessage {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  company: string;
  subject: string;
  subject_display: string;
  message: string;
  status: 'new' | 'read' | 'replied';
  admin_note: string;
  created_at: string;
}

const STATUS_STYLES = {
  new:     'bg-red-100 text-red-700',
  read:    'bg-blue-100 text-blue-700',
  replied: 'bg-emerald-100 text-emerald-700',
};

export default function ContactMessagesPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ContactMessage | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const params = new URLSearchParams();
  if (statusFilter) params.set('status', statusFilter);
  if (search) params.set('search', search);

  const { data, isLoading, mutate } = useSWR(
    `/admin/contact-messages/?${params}`,
    fetcher,
    { refreshInterval: 30000 },
  );

  const messages: ContactMessage[] = data?.results ?? [];
  const counts = data?.counts ?? { new: 0, read: 0, replied: 0 };

  const updateMessage = async (id: string, updates: { status?: string; admin_note?: string }) => {
    setSaving(true);
    try {
      await api.put(`/admin/contact-messages/${id}/`, updates);
      await mutate();
      if (selected?.id === id) {
        setSelected(prev => prev ? { ...prev, ...updates } as ContactMessage : null);
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteMessage = async (id: string) => {
    if (!confirm('Delete this message?')) return;
    await api.delete(`/admin/contact-messages/${id}/`);
    setSelected(null);
    mutate();
  };

  const openMessage = async (msg: ContactMessage) => {
    setSelected(msg);
    setNote(msg.admin_note);
    if (msg.status === 'new') {
      await updateMessage(msg.id, { status: 'read' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Contact Messages</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Messages submitted via the contact form</p>
        </div>
        <button
          onClick={() => mutate()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Count cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: 'New', key: 'new', color: 'bg-red-100 text-red-600' },
          { label: 'Read', key: 'read', color: 'bg-blue-100 text-blue-600' },
          { label: 'Replied', key: 'replied', color: 'bg-emerald-100 text-emerald-600' },
        ].map(({ label, key, color }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(statusFilter === key ? '' : key)}
            className={`bg-white rounded-xl border-2 p-3 sm:p-4 text-left transition-all hover:shadow-md ${statusFilter === key ? 'border-blue-400' : 'border-gray-200'}`}
          >
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{counts[key as keyof typeof counts]}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>{label}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text" placeholder="Search by name, email, company…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <CustomSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: '', label: 'All statuses' },
            { value: 'new', label: 'New' },
            { value: 'read', label: 'Read' },
            { value: 'replied', label: 'Replied' },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Message list */}
        <div className="space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading…
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No messages found</p>
            </div>
          ) : (
            messages.map(msg => (
              <button
                key={msg.id}
                onClick={() => openMessage(msg)}
                className={`w-full text-left bg-white rounded-xl border-2 p-4 hover:shadow-md transition-all ${selected?.id === msg.id ? 'border-blue-400' : 'border-gray-200'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 text-sm">{msg.first_name} {msg.last_name}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLES[msg.status]}`}>
                        {msg.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{msg.email}</p>
                    {msg.company && <p className="text-xs text-gray-400">{msg.company}</p>}
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{msg.message}</p>
                  </div>
                  <p className="text-[10px] text-gray-400 shrink-0">
                    {new Date(msg.created_at).toLocaleDateString()}
                  </p>
                </div>
                <p className="text-[10px] text-blue-600 font-medium mt-2">{msg.subject_display}</p>
              </button>
            ))
          )}
        </div>

        {/* Message detail */}
        {selected ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5 sticky top-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-gray-900">{selected.first_name} {selected.last_name}</h3>
                <p className="text-xs text-gray-500">{new Date(selected.created_at).toLocaleString()}</p>
              </div>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_STYLES[selected.status]}`}>
                {selected.status}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Mail className="h-4 w-4 text-gray-400" />
                <a href={`mailto:${selected.email}`} className="text-blue-600 hover:underline">{selected.email}</a>
              </div>
              {selected.company && (
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Building2 className="h-4 w-4 text-gray-400" />
                  {selected.company}
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                  {selected.subject_display}
                </span>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{selected.message}</p>
            </div>

            {/* Admin note */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Admin Note</label>
              <textarea
                value={note} onChange={e => setNote(e.target.value)}
                rows={3} placeholder="Add internal note…"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => updateMessage(selected.id, { status: 'replied', admin_note: note })}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-60"
              >
                <Reply className="h-3.5 w-3.5" /> Mark Replied
              </button>
              <button
                onClick={() => updateMessage(selected.id, { status: 'read', admin_note: note })}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-60"
              >
                <Eye className="h-3.5 w-3.5" /> Mark Read
              </button>
              <button
                onClick={() => updateMessage(selected.id, { admin_note: note })}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-semibold disabled:opacity-60"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Save Note
              </button>
              <button
                onClick={() => deleteMessage(selected.id)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold ml-auto"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>

            <a
              href={`mailto:${selected.email}?subject=Re: ${selected.subject_display}`}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-[#1e3a5f] hover:bg-[#172f4d] text-white text-sm font-semibold transition-colors"
            >
              <Mail className="h-4 w-4" /> Reply via Email
            </a>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 flex items-center justify-center py-20 text-gray-400">
            <div className="text-center">
              <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Select a message to view</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
