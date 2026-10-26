'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch.js';
import { Button, ErrorText, Spinner } from '@/components/shared/ui.jsx';
import { Field, inputClass } from '@/components/shared/form.jsx';

export function LoginForm({ next }) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiFetch('/api/auth/login', { method: 'POST', body: { identifier, password } });
      router.replace(next);
      router.refresh();
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Employee ID, email or username" htmlFor="identifier">
        <input
          id="identifier"
          className={inputClass}
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          placeholder="MWG-001"
          required
        />
      </Field>
      <Field label="Password" htmlFor="password">
        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            className={`${inputClass} pr-10`}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </Field>
      <ErrorText>{error}</ErrorText>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy && <Spinner />}
        Sign in
      </Button>
    </form>
  );
}
