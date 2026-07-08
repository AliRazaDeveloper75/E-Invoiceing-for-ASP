'use client';

/**
 * useAutosaveDraft — autosave to the server (database).
 *
 * Persists a serializable form snapshot to the backend via onServerSave
 * on every change (debounced), plus a final flush when the tab is hidden or
 * closed. The server-side InvoiceDraft model stores the raw JSON so the user
 * can resume an in-progress invoice from any device.
 *
 * Pair with the server GET endpoint to restore on mount and DELETE to clear
 * after a successful save — see usage in the invoice create forms.
 *
 * Legacy localStorage helpers loadDraft / clearDraft are kept as no-ops
 * for backward compatibility.
 */
import { useCallback, useEffect, useRef } from 'react';

export type DraftEnvelope<T> = { data: T; savedAt: number };

/**
 * Deprecated — localStorage is no longer used.
 * Returns null; restore drafts from the server instead.
 */
export function loadDraft<T>(_key: string): DraftEnvelope<T> | null {
  return null;
}

/**
 * Deprecated — localStorage is no longer used.
 * No-op kept for backward compatibility; clear drafts via the server API.
 */
export function clearDraft(_key: string): void {
  /* no-op — use server-side API for clearing drafts */
}

type Options<T> = {
  /** Deprecated — previously the localStorage key. Kept for interface compat. */
  key: string;
  /** Current serializable snapshot of the form. */
  data: T;
  /** Pause autosave (e.g. while submitting or after success). Default true. */
  enabled?: boolean;
  /** Skip saving empty/untouched forms so we don't prompt to resume nothing. */
  isEmpty?: (d: T) => boolean;
  /** Debounce window for change-driven saves (ms). Default 800. */
  debounceMs?: number;
  /** Called after each successful save with the timestamp (for a "Saved" badge). */
  onSaved?: (savedAt: number) => void;
  /**
   * Server-side persistence callback. Required for actual saving — saves the
   * snapshot to the backend (InvoiceDraft model). Failures are swallowed so
   * the UI is never blocked.
   */
  onServerSave?: (data: T) => void | Promise<void>;
};

/**
 * Returns `{ flush }` — call `flush()` to force an immediate save to the server.
 */
export function useAutosaveDraft<T>({
  key: _key,
  data,
  enabled = true,
  isEmpty,
  debounceMs = 800,
  onSaved,
  onServerSave,
}: Options<T>) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(data);
  latest.current = data;
  const serverSaveRef = useRef(onServerSave);
  serverSaveRef.current = onServerSave;

  const flush = useCallback(() => {
    const d = latest.current;
    if (isEmpty && isEmpty(d)) return;
    if (serverSaveRef.current) {
      try {
        Promise.resolve(serverSaveRef.current(d)).catch(() => {});
      } catch {
        /* ignore — best-effort */
      }
    }
    const savedAt = Date.now();
    onSaved?.(savedAt);
  }, [isEmpty, onSaved]);

  // Debounced save whenever the snapshot changes.
  useEffect(() => {
    if (!enabled) return;
    if (isEmpty && isEmpty(data)) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, debounceMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [data, enabled, debounceMs, flush, isEmpty]);

  // Final flush on tab hide / close — best-effort capture before the page dies.
  useEffect(() => {
    if (!enabled) return;
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    const onUnload = () => flush();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', onUnload);
    window.addEventListener('pagehide', onUnload);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('beforeunload', onUnload);
      window.removeEventListener('pagehide', onUnload);
    };
  }, [enabled, flush]);

  return { flush };
}
