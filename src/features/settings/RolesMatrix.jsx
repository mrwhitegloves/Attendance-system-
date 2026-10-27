'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Plus } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch.js';
import { Button, Card, ErrorText } from '@/components/shared/ui.jsx';
import { compactInputClass, Select } from '@/components/shared/form.jsx';

const SCOPE_OPTIONS = [
  { value: '', label: '—' },
  { value: 'own', label: 'Own' },
  { value: 'team', label: 'Team' },
  { value: 'all', label: 'All' },
];

// Permissions grouped by the part of the HRMS they belong to.
const AREAS = {
  attendance: 'Attendance',
  leave: 'Leave',
  users: 'Employees',
  kyc: 'KYC and bank',
  documents: 'Documents',
  letters: 'Letters',
  salary: 'Salary',
  notifications: 'Notifications',
  settings: 'Settings',
  roles: 'Settings',
  audit: 'Audit',
};

/** Roles as columns, permissions as rows. Every change is saved at once. */
export function RolesMatrix({ data }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [newRole, setNewRole] = useState({ label: '', copyFrom: 'employee' });

  const save = async (role, permission, value) => {
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/api/roles/${role.key}`, {
        method: 'PATCH',
        body: { permissions: { ...role.permissions, [permission]: value } },
      });
      router.refresh();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };
  const add = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiFetch('/api/roles', { method: 'POST', body: newRole });
      setNewRole({ ...newRole, label: '' });
      router.refresh();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };

  let lastArea = null;
  return (
    <div className="space-y-4">
      <Card>
        <form onSubmit={add} className="flex flex-wrap items-center gap-2 p-3">
          <input
            className={`${compactInputClass} min-w-0 flex-1 sm:max-w-xs`}
            placeholder="New role name (e.g. Field Supervisor)"
            value={newRole.label}
            onChange={(event) => setNewRole({ ...newRole, label: event.target.value })}
            required
            aria-label="New role name"
          />
          <span className="text-xs text-muted">starting from</span>
          <Select
            className={compactInputClass}
            value={newRole.copyFrom}
            onChange={(event) => setNewRole({ ...newRole, copyFrom: event.target.value })}
            options={data.roles
              .filter((role) => !role.locked)
              .map((role) => ({ value: role.key, label: role.label }))}
            aria-label="Copy permissions from"
          />
          <Button type="submit" size="sm" disabled={busy}>
            <Plus size={15} /> Add role
          </Button>
        </form>
        {error && (
          <div className="px-3 pb-3">
            <ErrorText>{error}</ErrorText>
          </div>
        )}
      </Card>
      <Card className={`overflow-x-auto ${busy ? 'opacity-70' : ''}`}>
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border text-xs">
            <tr>
              <th className="sticky left-0 bg-surface px-3 py-2 font-medium text-muted">
                Permission
              </th>
              {data.roles.map((role) => (
                <th key={role.key} className="px-2 py-2 text-center font-medium">
                  <span className="inline-flex items-center gap-1">
                    {role.locked && <Lock size={12} className="text-muted" />}
                    {role.label}
                  </span>
                  <span className="block text-[11px] font-normal text-muted">
                    {role.people} active
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.permissions.map((permission) => {
              const area = AREAS[permission.key.split('.')[0]];
              const header = area !== lastArea;
              lastArea = area;
              return [
                header && (
                  <tr key={`area-${area}`} className="bg-raised">
                    <td
                      colSpan={data.roles.length + 1}
                      className="px-3 py-1.5 text-xs font-semibold text-muted"
                    >
                      {area}
                    </td>
                  </tr>
                ),
                <tr key={permission.key} className="border-b border-border">
                  <td className="sticky left-0 bg-surface px-3 py-2">{permission.label}</td>
                  {data.roles.map((role) => {
                    const value = role.permissions[permission.key] || '';
                    return (
                      <td key={role.key} className="px-2 py-1.5 text-center">
                        {permission.scoped ? (
                          <Select
                            className={`${compactInputClass} h-8 text-xs`}
                            value={value}
                            disabled={role.locked || busy}
                            onChange={(event) =>
                              save(role, permission.key, event.target.value || false)
                            }
                            options={SCOPE_OPTIONS}
                            aria-label={`${role.label}: ${permission.label}`}
                          />
                        ) : (
                          <input
                            type="checkbox"
                            checked={value === true}
                            disabled={role.locked || busy}
                            onChange={(event) => save(role, permission.key, event.target.checked)}
                            aria-label={`${role.label}: ${permission.label}`}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>,
              ];
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
