'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch.js';
import { shrinkImage } from '@/lib/readFile.js';
import { Avatar } from '@/components/shared/Avatar.jsx';

/** The employee's photo; people who may edit can click it to choose a new one. */
export function PhotoUpload({ employee, canEdit }) {
  const router = useRouter();
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!canEdit) return <Avatar name={employee.name} src={employee.photoUrl} size="xl" />;

  const choose = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const photo = await shrinkImage(file);
      await apiFetch(`/api/users/${employee._id}/photo`, { method: 'POST', body: { photo } });
      router.refresh();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        className="group relative block rounded-full"
        title="Change photo"
        aria-label="Change photo"
      >
        <Avatar name={employee.name} src={employee.photoUrl} size="xl" />
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100">
          <Camera size={20} />
        </span>
        {busy && <span className="absolute inset-0 animate-pulse rounded-full bg-black/40" />}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={choose}
      />
      {error && <p className="absolute left-0 top-full mt-1 w-48 text-xs text-danger">{error}</p>}
    </div>
  );
}
