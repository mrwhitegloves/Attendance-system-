'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Circle, CircleCheckBig, Play } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch.js';
import { formatDateTime } from '@/lib/format.js';
import { Badge, Button, Card, CardHeader, EmptyState, ErrorText } from '@/components/shared/ui.jsx';

/** The joining checklist of one employee: tasks HR ticks, and the automatic checks. */
export function OnboardingPanel({ userId, onboarding, canManage }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (path, options) => {
    setBusy(true);
    setError('');
    try {
      await apiFetch(path, options);
      router.refresh();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };
  const base = `/api/users/${userId}/onboarding`;

  if (!onboarding) {
    return (
      <Card>
        <EmptyState
          title="Onboarding not started"
          text="It starts by itself when a candidate joins. For anyone else, start it here."
          action={
            canManage && (
              <Button onClick={() => run(base, { method: 'POST' })} disabled={busy}>
                <Play size={15} /> Start onboarding
              </Button>
            )
          }
        />
        {error && (
          <div className="px-4 pb-4">
            <ErrorText>{error}</ErrorText>
          </div>
        )}
      </Card>
    );
  }

  const open = onboarding.status === 'in_progress';
  const editable = canManage && open;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Joining checklist"
          subtitle={
            open
              ? `${onboarding.progress.done} of ${onboarding.progress.total} done`
              : `Joining confirmed by ${onboarding.completedByName} · ${formatDateTime(onboarding.completedAt)}`
          }
          action={
            open ? (
              editable && (
                <Button
                  size="sm"
                  disabled={busy || !onboarding.ready}
                  onClick={() => run(`${base}/complete`, { method: 'POST' })}
                  title={onboarding.ready ? undefined : 'Finish every item first'}
                >
                  <CircleCheckBig size={15} /> Confirm joining
                </Button>
              )
            ) : (
              <Badge tone="success">Completed</Badge>
            )
          }
        />
        <ul className="divide-y divide-border text-sm">
          {onboarding.tasks.map((task) => (
            <li key={task._id} className="flex items-start gap-3 px-4 py-2.5">
              <button
                type="button"
                className={task.done ? 'text-success' : 'text-muted'}
                disabled={!editable || busy}
                aria-label={
                  task.done ? `Mark "${task.label}" not done` : `Mark "${task.label}" done`
                }
                onClick={() =>
                  run(`${base}/tasks/${task._id}`, { method: 'PATCH', body: { done: !task.done } })
                }
              >
                {task.done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
              </button>
              <span className="flex-1">
                <span className={task.done ? 'text-muted line-through' : ''}>{task.label}</span>
                {task.done && (
                  <span className="block text-xs text-muted">
                    {task.doneByName} · {formatDateTime(task.doneAt)}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader
          title="Checked automatically"
          subtitle="These tick themselves from the employee file."
        />
        <ul className="divide-y divide-border text-sm">
          {onboarding.checks.map((check) => (
            <li key={check.key} className="flex items-start gap-3 px-4 py-2.5">
              <span className={check.done ? 'text-success' : 'text-muted'}>
                {check.done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
              </span>
              <span>
                {check.label}
                {!check.done && check.detail && (
                  <span className="block text-xs text-muted">{check.detail}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}
