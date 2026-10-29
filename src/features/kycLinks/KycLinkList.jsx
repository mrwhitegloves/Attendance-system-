'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Link2, MessageCircle, Trash2, UserPlus, XCircle } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch.js';
import { useListParams } from '@/lib/useListParams.js';
import { formatDateTime } from '@/lib/format.js';
import { Badge, Button, Card, ErrorText, Spinner } from '@/components/shared/ui.jsx';
import { DataTable, Pagination } from '@/components/shared/DataTable.jsx';
import { ConfirmDialog, Dialog } from '@/components/shared/Dialog.jsx';
import { compactInputClass, Field, inputClass, Select } from '@/components/shared/form.jsx';

const STATE = {
  open: { label: 'Waiting for the employee', tone: 'info' },
  submitted: { label: 'Submitted', tone: 'success' },
  expired: { label: 'Expired', tone: 'warning' },
  closed: { label: 'Closed', tone: 'neutral' },
};

const fullUrl = (path) => `${window.location.origin}${path}`;

/** Employee KYC links: make one, copy or send it, see who has submitted. */
export function KycLinkList({ result, employees }) {
  const router = useRouter();
  const { get, set, isPending } = useListParams();
  const [search, setSearch] = useState(get('q'));
  const [dialog, setDialog] = useState(null); // 'employee' | 'new'
  const [made, setMade] = useState(null);
  // { row, action: 'close' | 'delete' }
  const [closing, setClosing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const copy = async (path) => {
    try {
      await navigator.clipboard.writeText(fullUrl(path));
      setCopied(path);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      window.prompt('Copy this link:', fullUrl(path));
    }
  };

  const close = async () => {
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/api/kyc-links/${closing.row._id}`, {
        method: closing.action === 'delete' ? 'DELETE' : 'POST',
      });
      setClosing(null);
      router.refresh();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="mb-3 flex flex-wrap justify-end gap-2">
        <Button onClick={() => setDialog('employee')}>
          <Link2 size={16} /> KYC link for an employee
        </Button>
        <Button variant="secondary" onClick={() => setDialog('new')}>
          <UserPlus size={16} /> New person
        </Button>
      </div>
      {error && (
        <div className="mb-3">
          <ErrorText>{error}</ErrorText>
        </div>
      )}
      <Card className={isPending ? 'opacity-60' : ''}>
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              set({ q: search.trim() });
            }}
            className="min-w-0 flex-1 sm:max-w-xs"
          >
            <input
              className={`${compactInputClass} w-full`}
              placeholder="Search name, phone, employee ID"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search"
            />
          </form>
        </div>
        <DataTable
          rows={result.items}
          onRowClick={(row) => row.employee._id && router.push(`/employees/${row.employee._id}`)}
          empty={{
            title: 'No KYC links yet',
            text: 'Make a link and send it to the employee on WhatsApp.',
          }}
          columns={[
            {
              key: 'employee',
              label: 'Employee',
              render: (row) => (
                <div>
                  <p className="font-medium">{row.employee.name}</p>
                  <p className="text-xs text-muted">
                    {[row.employee.employeeId, row.employee.phone].filter(Boolean).join(' · ')}
                    {row.employee.status && row.employee.status !== 'active'
                      ? ' · account not active yet'
                      : ''}
                  </p>
                </div>
              ),
            },
            {
              key: 'state',
              label: 'Status',
              render: (row) => <Badge tone={STATE[row.state].tone}>{STATE[row.state].label}</Badge>,
            },
            {
              key: 'when',
              label: 'Made / submitted',
              mobile: false,
              render: (row) => (
                <span className="text-xs text-muted">
                  {formatDateTime(row.createdAt)}
                  {row.submittedAt ? (
                    <>
                      <br />
                      {formatDateTime(row.submittedAt)}
                    </>
                  ) : null}
                </span>
              ),
            },
            {
              key: 'actions',
              label: '',
              render: (row) => (
                <div
                  className="flex justify-end gap-1"
                  onClick={(event) => event.stopPropagation()}
                >
                  {row.state === 'open' && (
                    <>
                      <Button variant="secondary" size="sm" onClick={() => copy(row.path)}>
                        <Copy size={14} /> {copied === row.path ? 'Copied' : 'Copy link'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Close the link"
                        title="Close the link"
                        onClick={() => setClosing({ row, action: 'close' })}
                      >
                        <XCircle size={14} />
                      </Button>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Delete the link"
                    title="Delete"
                    onClick={() => setClosing({ row, action: 'delete' })}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ),
            },
          ]}
        />
        <Pagination page={result.page} pages={result.pages} total={result.total} />
      </Card>

      {dialog && (
        <MakeLinkDialog
          kind={dialog}
          employees={employees}
          onClose={() => setDialog(null)}
          onMade={(link) => {
            setDialog(null);
            setMade(link);
            router.refresh();
          }}
        />
      )}
      {made && <LinkMadeDialog link={made} onClose={() => setMade(null)} />}
      <ConfirmDialog
        open={Boolean(closing)}
        title={closing?.action === 'delete' ? 'Delete this KYC link?' : 'Close this link?'}
        text={
          closing?.action === 'delete'
            ? 'The link stops working and moves to Settings → Recently deleted, where you can restore it for 90 days. What the employee already sent stays in their file.'
            : 'The link stops working. You can make a new one at any time.'
        }
        confirmLabel={closing?.action === 'delete' ? 'Delete' : 'Close link'}
        danger
        busy={busy}
        onConfirm={close}
        onClose={() => setClosing(null)}
      />
    </>
  );
}

function MakeLinkDialog({ kind, employees, onClose, onMade }) {
  const [userId, setUserId] = useState('');
  const [person, setPerson] = useState({ name: '', phone: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { link } = await apiFetch('/api/kyc-links', {
        method: 'POST',
        body: kind === 'employee' ? { userId } : person,
      });
      onMade({
        ...link,
        name: kind === 'employee' ? employees.find((e) => e._id === userId)?.name : person.name,
        phone: kind === 'employee' ? '' : person.phone,
      });
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={kind === 'employee' ? 'KYC link for an employee' : 'KYC link for a new person'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="make-kyc-link" disabled={busy}>
            {busy && <Spinner />} Make the link
          </Button>
        </>
      }
    >
      <form id="make-kyc-link" onSubmit={submit} className="space-y-3">
        {kind === 'employee' ? (
          <Field
            label="Employee"
            htmlFor="kyc-employee"
            hint="An older open link of this employee stops working."
          >
            <Select
              id="kyc-employee"
              required
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              options={[
                { value: '', label: 'Choose…' },
                ...employees.map((employee) => ({
                  value: employee._id,
                  label: `${employee.name} (${employee.employeeId})`,
                })),
              ]}
            />
          </Field>
        ) : (
          <>
            <p className="text-sm text-muted">
              The person is added as an employee whose account is not active yet. Add their job
              details and a password later, then set the status to Active.
            </p>
            <Field label="Full name" htmlFor="kyc-name">
              <input
                id="kyc-name"
                className={inputClass}
                required
                minLength={2}
                value={person.name}
                onChange={(event) => setPerson({ ...person, name: event.target.value })}
              />
            </Field>
            <Field label="Mobile number" htmlFor="kyc-phone">
              <input
                id="kyc-phone"
                type="tel"
                className={inputClass}
                required
                minLength={10}
                value={person.phone}
                onChange={(event) => setPerson({ ...person, phone: event.target.value })}
              />
            </Field>
          </>
        )}
        <ErrorText>{error}</ErrorText>
      </form>
    </Dialog>
  );
}

/** The new link, ready to copy or to send on WhatsApp. */
function LinkMadeDialog({ link, onClose }) {
  const url = fullUrl(link.path);
  const [copied, setCopied] = useState(false);
  const message = `Hello${link.name ? ` ${link.name}` : ''}, please fill in your KYC details here: ${url}`;
  const digits = String(link.phone || '')
    .replace(/\D/g, '')
    .slice(-10);
  return (
    <Dialog open onClose={onClose} title="The KYC link is ready">
      <div className="space-y-3">
        <p className="text-sm text-muted">
          Anyone with this link can open the form, so send it only to {link.name || 'the employee'}.
          It works for 30 days or until the form is sent.
        </p>
        <input
          readOnly
          className={inputClass}
          value={url}
          onFocus={(event) => event.target.select()}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setCopied(true);
              } catch {
                window.prompt('Copy this link:', url);
              }
            }}
          >
            <Copy size={16} /> {copied ? 'Copied' : 'Copy link'}
          </Button>
          <a
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium hover:bg-raised"
            href={`https://wa.me/${digits ? `91${digits}` : ''}?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle size={16} /> Send on WhatsApp
          </a>
        </div>
      </div>
    </Dialog>
  );
}
