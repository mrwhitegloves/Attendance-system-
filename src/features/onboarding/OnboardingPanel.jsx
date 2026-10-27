'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CircleCheckBig, Play } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch.js';
import { formatDateTime } from '@/lib/format.js';
import { Badge, Button, Card, CardHeader, EmptyState, ErrorText } from '@/components/shared/ui.jsx';
import { AutomaticChecks, TaskList } from './Checklist.jsx';

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
        <TaskList
          tasks={onboarding.tasks}
          editable={editable}
          busy={busy}
          onToggle={(task) =>
            run(`${base}/tasks/${task._id}`, { method: 'PATCH', body: { done: !task.done } })
          }
        />
      </Card>
      <AutomaticChecks checks={onboarding.checks} />
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}
