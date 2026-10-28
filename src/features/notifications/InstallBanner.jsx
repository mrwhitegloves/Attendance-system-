'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/shared/ui.jsx';

const noSubscribe = () => () => {};

// 'installed', 'dismissed', 'ios' or 'other' — read from the browser, never on the server.
function deviceState() {
  if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
    return 'installed';
  }
  try {
    if (localStorage.getItem('install-banner-dismissed') === '1') return 'dismissed';
  } catch {
    // Private mode: show it.
  }
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ? 'ios' : 'other';
}

/** Offers to install the app on a phone (Android prompt, or the iPhone "Add to Home Screen" hint). */
export function InstallBanner() {
  const device = useSyncExternalStore(noSubscribe, deviceState, () => 'installed');
  const [prompt, setPrompt] = useState(null);
  const [closed, setClosed] = useState(false);
  const ios = device === 'ios';

  useEffect(() => {
    if (device !== 'other') return undefined;
    const onPrompt = (event) => {
      event.preventDefault();
      setPrompt(event);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, [device]);

  if (closed || !(ios || prompt)) return null;
  const dismiss = () => {
    setClosed(true);
    try {
      localStorage.setItem('install-banner-dismissed', '1');
    } catch {
      // Ignore.
    }
  };
  return (
    <div className="flex items-center gap-3 rounded-xl border border-brand/30 bg-brand/5 p-3 text-sm">
      <Download size={18} className="shrink-0 text-brand" />
      <p className="flex-1">
        {ios
          ? 'Install the app: tap Share, then "Add to Home Screen".'
          : 'Install the app on this phone for quick punching and reminders.'}
      </p>
      {prompt && (
        <Button size="sm" onClick={() => prompt.prompt().then(dismiss)}>
          Install
        </Button>
      )}
      <button type="button" onClick={dismiss} className="rounded p-1 text-muted" aria-label="Hide">
        <X size={16} />
      </button>
    </div>
  );
}
