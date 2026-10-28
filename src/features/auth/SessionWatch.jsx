'use client';

import { useEffect } from 'react';

const CHECK_EVERY_MS = 15 * 1000;

/**
 * Sends the page to the sign-in screen as soon as the session is gone (account switched off,
 * password changed, signed out elsewhere): at once on a push from the server, otherwise at the
 * next check (every 15 seconds while the page is visible, and when the person comes back to it).
 */
export function SessionWatch() {
  useEffect(() => {
    let stopped = false;
    const toSignIn = () => {
      if (stopped) return;
      stopped = true;
      window.location.replace('/login?ended=1');
    };
    const check = async () => {
      if (stopped || document.visibilityState !== 'visible') return;
      const response = await fetch('/api/auth/me', { credentials: 'same-origin' }).catch(
        () => null,
      );
      if (response?.status === 401) toSignIn();
    };
    const onMessage = (event) => {
      if (event.data?.type === 'SESSION_ENDED') toSignIn();
    };

    const timer = setInterval(check, CHECK_EVERY_MS);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    navigator.serviceWorker?.addEventListener('message', onMessage);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
      navigator.serviceWorker?.removeEventListener('message', onMessage);
    };
  }, []);
  return null;
}
