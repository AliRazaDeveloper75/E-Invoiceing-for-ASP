'use client';

/**
 * useAutosaveDraft — crash/power-loss-proof autosave to localStorage.
 *
 * Persists a serializable form snapshot to localStorage on every change
 * (debounced), plus a final synchronous flush when the tab is hidden or
 * closed. localStorage writes hit disk immediately, so an abrupt power cut
 * or browser crash keeps the last snapshot — the user can resume their
 * in-progress invoice instead of losing it.
 *
 * Pair with `loadDraft()` (restore on mount) and `clearDraft()` (after a
 * successful save) — see usage in the invoice create forms.
 */
import { useCallback, useEffect, useRef } from 'react';

export type DraftEnvelope<T> = { data: T; savedAt: number };

/** Read a saved draft (returns null if none / corrupt). */
export function loadDraft<T>(key: string): DraftEnvelope<T> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftEnvelope<T>;
    if (!parsed || typeof parsed.savedAt !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Remove a saved draft (call after the invoice is successfully saved). */
export function clearDraft(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

type Options<T> = {
  /** localStorage key, e.g. `invoice-draft:pint`. */
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
   * Optional server sync — persists the same snapshot to the backend on a
   * longer debounce (cross-device durability). Failures are swallowed so the
   * local autosave is never blocked.
   */
  onServerSave?: (data: T) => void | Promise<void>;
  /** Debounce window for server saves (ms). Default 10000. */
  serverDebounceMs?: number;
};

/**
 * Returns `{ flush }` — call `flush()` to force an immediate save.
 */
export function useAutosaveDraft<T>({
  key,
  data,
  enabled = true,
  isEmpty,
  debounceMs = 800,
  onSaved,
  onServerSave,
  serverDebounceMs = 10000,
}: Options<T>) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(data);
  latest.current = data;
  const serverSaveRef = useRef(onServerSave);
  serverSaveRef.current = onServerSave;

  const flush = useCallback(() => {
    const d = latest.current;
    if (isEmpty && isEmpty(d)) return;
    try {
      const savedAt = Date.now();
      localStorage.setItem(key, JSON.stringify({ data: d, savedAt }));
      onSaved?.(savedAt);
    } catch {
      /* localStorage full / unavailable — best effort */
    }
  }, [key, isEmpty, onSaved]);

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

  // Debounced server sync (longer interval) — best-effort durability.
  useEffect(() => {
    if (!enabled || !serverSaveRef.current) return;
    if (isEmpty && isEmpty(data)) return;
    if (serverTimer.current) clearTimeout(serverTimer.current);
    serverTimer.current = setTimeout(() => {
      try {
        Promise.resolve(serverSaveRef.current?.(latest.current)).catch(() => {});
      } catch {
        /* ignore — local autosave already protects the user */
      }
    }, serverDebounceMs);
    return () => {
      if (serverTimer.current) clearTimeout(serverTimer.current);
    };
  }, [data, enabled, serverDebounceMs, isEmpty]);

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
