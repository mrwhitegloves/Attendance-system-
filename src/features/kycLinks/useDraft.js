'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Saving the KYC form while the employee types (founder, 2026-10-30):
// - every change is kept on this device at once (localStorage, without the PAN and account
//   number), so even a reload without internet keeps the answers;
// - the server copy (sealed) is saved 1 second after typing stops, and at least every 5 seconds
//   while typing goes on; nothing is sent when nothing changed;
// - every save carries a growing number (rev); the server ignores an older one that arrives late;
// - when the page is hidden or closed, the last change is sent at once (keepalive);
// - after a failed save it is tried again when the internet is back.

const PRIVATE = ['pan.number', 'bank.accountNumber', 'accountNumberAgain'];
const QUIET_MS = 1000;
const MAX_WAIT_MS = 5000;

const storageKey = (token) => `kyc-draft:${token}`;

/** { pan: { number } } → { 'pan.number' } (a form sent back by HR is stored nested). */
export function flattenDraft(draft) {
  const flat = {};
  for (const [key, value] of Object.entries(draft ?? {})) {
    if (value && typeof value === 'object') {
      for (const [inner, innerValue] of Object.entries(value)) {
        flat[`${key}.${inner}`] = innerValue == null ? '' : innerValue;
      }
    } else {
      flat[key] = typeof value === 'number' ? String(value) : (value ?? '');
    }
  }
  if (flat['bank.accountNumber'] && !flat.accountNumberAgain) {
    flat.accountNumberAgain = flat['bank.accountNumber'];
  }
  return flat;
}

/** The device's copy, when it is newer than the server's. */
export function readLocalDraft(token, serverRev) {
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey(token)) ?? 'null');
    return saved && saved.rev > serverRev ? saved.data : null;
  } catch {
    return null;
  }
}

/** Keeps `form` saved. Returns { status: 'idle'|'saving'|'saved'|'offline', clear() }. */
export function useDraftSaver(token, form, { enabled = true } = {}) {
  const [status, setStatus] = useState('idle');
  const lastSent = useRef(JSON.stringify(form));
  const pending = useRef(null);
  const timer = useRef(null);
  const firstChangeAt = useRef(null);

  const flush = useCallback(
    async ({ keepalive = false } = {}) => {
      clearTimeout(timer.current);
      const next = pending.current;
      if (!next) return;
      pending.current = null;
      firstChangeAt.current = null;
      setStatus('saving');
      try {
        const response = await fetch(`/api/public/kyc/${token}/draft`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rev: next.rev, draft: next.form }),
          keepalive,
        });
        if (response.status === 409 || response.status === 410) {
          setStatus('idle'); // the form was sent or the link stopped: nothing to save
          return;
        }
        if (!response.ok) throw new Error('save failed');
        lastSent.current = JSON.stringify(next.form);
        setStatus('saved');
      } catch {
        // Keep it for the next try (unless a newer change is already waiting).
        pending.current = pending.current ?? next;
        setStatus('offline');
      }
    },
    [token],
  );

  useEffect(() => {
    if (!enabled) return;
    const serialized = JSON.stringify(form);
    if (serialized === lastSent.current && !pending.current) return;
    const rev = Date.now();
    try {
      const safe = Object.fromEntries(
        Object.entries(form).filter(([key]) => !PRIVATE.includes(key)),
      );
      window.localStorage.setItem(storageKey(token), JSON.stringify({ rev, data: safe }));
    } catch {
      // Private mode or full storage: the server copy still works.
    }
    pending.current = { rev, form };
    firstChangeAt.current ??= Date.now();
    clearTimeout(timer.current);
    const waited = Date.now() - firstChangeAt.current;
    timer.current = setTimeout(flush, waited >= MAX_WAIT_MS ? 0 : QUIET_MS);
  }, [form, enabled, token, flush]);

  useEffect(() => {
    if (!enabled) return undefined;
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush({ keepalive: true });
    };
    const onLeave = () => flush({ keepalive: true });
    const onOnline = () => flush();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onLeave);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onLeave);
      window.removeEventListener('online', onOnline);
      clearTimeout(timer.current);
    };
  }, [enabled, flush]);

  const clear = useCallback(() => {
    clearTimeout(timer.current);
    pending.current = null;
    try {
      window.localStorage.removeItem(storageKey(token));
    } catch {
      // nothing to remove
    }
  }, [token]);

  return { status, clear };
}
