'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check, Pencil, Send } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch.js';
import { formatDateTime, formatDay } from '@/lib/format.js';
import {
  PLAN_OUTCOMES,
  RATINGS,
  REVIEW_KINDS,
  REVIEW_STATUS,
  planOutcomeOptions,
} from '@/config/performanceOptions.js';
import { Badge, Button, ButtonLink, Card, CardHeader, ErrorText } from '@/components/shared/ui.jsx';
import { Field, inputClass, Select } from '@/components/shared/form.jsx';

/** One review: what the reviewer wrote, sharing, the employee's reply, a plan's outcome. */
export function ReviewDetail({ review }) {
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
  const can = review.permissions;
  const plan = review.kind === 'improvement_plan';
  const text = [
    [plan ? 'Why this plan' : 'What went well', review.strengths],
    [plan ? 'What must change' : 'What to improve', review.improvements],
    ['Training or support planned', review.training],
  ].filter(([, value]) => value);

  return (
    <>
      <Link
        href="/performance"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-text"
      >
        <ArrowLeft size={15} /> Performance
      </Link>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted">
            {REVIEW_KINDS[review.kind]} · {formatDay(review.periodStart)} to{' '}
            {formatDay(review.periodEnd)}
          </p>
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold">
            {review.employeeName}
            <Badge tone={REVIEW_STATUS[review.status].tone}>
              {REVIEW_STATUS[review.status].label}
            </Badge>
          </h1>
          <p className="text-sm text-muted">By {review.reviewerName}</p>
        </div>
        {can.edit && (
          <div className="flex gap-2">
            <ButtonLink variant="secondary" size="sm" href={`/performance/${review._id}/edit`}>
              <Pencil size={15} /> Edit
            </ButtonLink>
            <Button
              size="sm"
              disabled={busy}
              onClick={() => run(`/api/reviews/${review._id}/share`, { method: 'POST' })}
            >
              <Send size={15} /> Share with employee
            </Button>
          </div>
        )}
      </div>
      {error && (
        <div className="mb-3">
          <ErrorText>{error}</ErrorText>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {review.goals.length > 0 && (
            <Card>
              <CardHeader title={plan ? 'Goals of the plan' : 'Targets and KPIs'} />
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border text-xs text-muted">
                    <tr>
                      <th className="px-4 py-2 font-medium">Goal</th>
                      <th className="px-4 py-2 font-medium">Target</th>
                      <th className="px-4 py-2 font-medium">Achieved</th>
                      <th className="px-4 py-2 font-medium">Rating</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {review.goals.map((goal, index) => (
                      <tr key={index}>
                        <td className="px-4 py-2.5 font-medium">{goal.title}</td>
                        <td className="px-4 py-2.5">{goal.target || '—'}</td>
                        <td className="px-4 py-2.5">{goal.achieved || '—'}</td>
                        <td className="px-4 py-2.5">
                          {goal.rating ? `${goal.rating} · ${RATINGS[goal.rating]}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
          {text.map(([label, value]) => (
            <Card key={label}>
              <CardHeader title={label} />
              <p className="whitespace-pre-wrap px-4 pb-4 text-sm">{value}</p>
            </Card>
          ))}
        </div>
        <div className="space-y-4">
          {!plan && (
            <Card>
              <CardHeader title="Overall rating" />
              <p className="px-4 pb-4 text-lg font-semibold">
                {review.rating
                  ? `${review.rating} / 5 · ${RATINGS[review.rating]}`
                  : 'Not rated yet'}
              </p>
            </Card>
          )}
          {plan && <Outcome review={review} editable={can.outcome} run={run} busy={busy} />}
          {review.status === 'acknowledged' && (
            <Card>
              <CardHeader
                title="Seen by the employee"
                subtitle={formatDateTime(review.acknowledgedAt)}
              />
              <p className="whitespace-pre-wrap px-4 pb-4 text-sm">
                {review.employeeComment || 'No comment.'}
              </p>
            </Card>
          )}
          {can.acknowledge && <Acknowledge review={review} run={run} busy={busy} />}
        </div>
      </div>
    </>
  );
}

function Acknowledge({ review, run, busy }) {
  const [comment, setComment] = useState('');
  return (
    <Card>
      <CardHeader
        title="Your reply"
        subtitle="Mark it as read. A comment is optional and cannot change later."
      />
      <div className="space-y-3 px-4 pb-4">
        <textarea
          className={`${inputClass} min-h-24`}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          maxLength={2000}
          aria-label="Comment"
        />
        <Button
          className="w-full"
          disabled={busy}
          onClick={() =>
            run(`/api/reviews/${review._id}/acknowledge`, {
              method: 'POST',
              body: comment.trim() ? { comment: comment.trim() } : {},
            })
          }
        >
          <Check size={15} /> I have read it
        </Button>
      </div>
    </Card>
  );
}

function Outcome({ review, editable, run, busy }) {
  const [form, setForm] = useState({ outcome: review.outcome, outcomeNote: review.outcomeNote });
  return (
    <Card>
      <CardHeader title="Outcome of the plan" />
      <div className="space-y-3 px-4 pb-4 text-sm">
        {!editable ? (
          <p>
            {review.outcome ? PLAN_OUTCOMES[review.outcome] : 'Not decided yet'}
            {review.outcomeNote ? ` · ${review.outcomeNote}` : ''}
          </p>
        ) : (
          <>
            <Field label="Outcome" htmlFor="plan-outcome">
              <Select
                id="plan-outcome"
                value={form.outcome}
                onChange={(event) => setForm({ ...form, outcome: event.target.value })}
                options={[{ value: '', label: 'Not decided yet' }, ...planOutcomeOptions]}
              />
            </Field>
            <Field label="Note" htmlFor="plan-note">
              <input
                id="plan-note"
                className={inputClass}
                value={form.outcomeNote}
                onChange={(event) => setForm({ ...form, outcomeNote: event.target.value })}
                maxLength={1000}
              />
            </Field>
            <Button
              size="sm"
              disabled={busy}
              onClick={() => run(`/api/reviews/${review._id}`, { method: 'PATCH', body: form })}
            >
              Save outcome
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
