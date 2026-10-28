'use client';

import { CheckCircle2, Circle } from 'lucide-react';
import { formatDateTime } from '@/lib/format.js';
import { Card, CardHeader } from '@/components/shared/ui.jsx';

/** Tasks a person ticks (onboarding, exit), with who ticked each and when. */
export function TaskList({ tasks, editable, busy, onToggle }) {
  return (
    <ul className="divide-y divide-border text-sm">
      {tasks.map((task) => (
        <li key={task._id} className="flex items-start gap-3 px-4 py-2.5">
          <button
            type="button"
            className={task.done ? 'text-success' : 'text-muted'}
            disabled={!editable || busy}
            aria-label={task.done ? `Mark "${task.label}" not done` : `Mark "${task.label}" done`}
            onClick={() => onToggle(task)}
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
  );
}

/** Items the server works out from the records (file complete, assets returned …). */
export function AutomaticChecks({ checks }) {
  return (
    <Card>
      <CardHeader
        title="Checked automatically"
        subtitle="These tick themselves from the records."
      />
      <ul className="divide-y divide-border text-sm">
        {checks.map((check) => (
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
  );
}
