'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch.js';
import { ratingOptions, reviewKindOptions } from '@/config/performanceOptions.js';
import { Button, ButtonLink, Card, ErrorText } from '@/components/shared/ui.jsx';
import { Field, compactInputClass, inputClass, Select } from '@/components/shared/form.jsx';

const emptyGoal = () => ({ title: '', target: '', achieved: '', rating: '' });

const fromReview = (review) => ({
  kind: review.kind,
  periodStart: review.periodStart,
  periodEnd: review.periodEnd,
  goals: review.goals.map((goal) => ({ ...goal, rating: goal.rating ? String(goal.rating) : '' })),
  rating: review.rating ? String(review.rating) : '',
  strengths: review.strengths,
  improvements: review.improvements,
  training: review.training,
});

/** Draft a review or improvement plan, or change a draft. Goals are the period's targets/KPIs. */
export function ReviewForm({ review = null, people = [], initialUserId = '' }) {
  const router = useRouter();
  const [userId, setUserId] = useState(initialUserId || people[0]?._id || '');
  const [form, setForm] = useState(() =>
    review
      ? fromReview(review)
      : {
          kind: 'review',
          periodStart: '',
          periodEnd: '',
          goals: [emptyGoal()],
          rating: '',
          strengths: '',
          improvements: '',
          training: '',
        },
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const change = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const changeGoal = (index, key) => (event) =>
    setForm({
      ...form,
      goals: form.goals.map((goal, at) =>
        at === index ? { ...goal, [key]: event.target.value } : goal,
      ),
    });

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const body = {
      ...form,
      goals: form.goals
        .filter((goal) => goal.title.trim())
        .map((goal) => ({ ...goal, rating: goal.rating ? Number(goal.rating) : null })),
      rating: form.rating ? Number(form.rating) : null,
    };
    try {
      const result = review
        ? await apiFetch(`/api/reviews/${review._id}`, { method: 'PATCH', body })
        : await apiFetch(`/api/users/${userId}/reviews`, { method: 'POST', body });
      router.push(`/performance/${result.review._id}`);
      router.refresh();
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  };

  const plan = form.kind === 'improvement_plan';
  return (
    <Card className="max-w-3xl">
      <form onSubmit={submit} className="space-y-4 p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {!review && (
            <Field label="Employee" htmlFor="review-person">
              <Select
                id="review-person"
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
                options={people.map((person) => ({
                  value: person._id,
                  label: `${person.name} (${person.employeeId})`,
                }))}
              />
            </Field>
          )}
          <Field label="Kind" htmlFor="review-kind">
            <Select
              id="review-kind"
              value={form.kind}
              onChange={change('kind')}
              options={reviewKindOptions}
            />
          </Field>
          <Field label="Period from" htmlFor="review-start">
            <input
              id="review-start"
              type="date"
              className={inputClass}
              value={form.periodStart}
              onChange={change('periodStart')}
              required
            />
          </Field>
          <Field label="Period to" htmlFor="review-end">
            <input
              id="review-end"
              type="date"
              className={inputClass}
              value={form.periodEnd}
              min={form.periodStart}
              onChange={change('periodEnd')}
              required
            />
          </Field>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">
            {plan ? 'Goals of the plan' : 'Targets and KPIs'}
          </p>
          <div className="space-y-2">
            {form.goals.map((goal, index) => (
              <div
                key={index}
                className="grid gap-2 rounded-lg border border-border p-2 sm:grid-cols-[2fr_1fr_1fr_auto_auto]"
              >
                <input
                  className={compactInputClass}
                  placeholder="Goal (e.g. Monthly bookings)"
                  value={goal.title}
                  onChange={changeGoal(index, 'title')}
                  maxLength={200}
                  aria-label={`Goal ${index + 1}`}
                />
                <input
                  className={compactInputClass}
                  placeholder="Target"
                  value={goal.target}
                  onChange={changeGoal(index, 'target')}
                  maxLength={200}
                  aria-label={`Target ${index + 1}`}
                />
                <input
                  className={compactInputClass}
                  placeholder="Achieved"
                  value={goal.achieved}
                  onChange={changeGoal(index, 'achieved')}
                  maxLength={200}
                  aria-label={`Achieved ${index + 1}`}
                />
                <Select
                  className={compactInputClass}
                  value={goal.rating}
                  onChange={changeGoal(index, 'rating')}
                  options={[
                    { value: '', label: 'Rating' },
                    ...ratingOptions.map((option) => ({
                      value: option.value,
                      label: `${option.value} · ${option.label}`,
                    })),
                  ]}
                  aria-label={`Rating ${index + 1}`}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setForm({ ...form, goals: form.goals.filter((_, at) => at !== index) })
                  }
                  aria-label={`Remove goal ${index + 1}`}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="mt-2"
            onClick={() => setForm({ ...form, goals: [...form.goals, emptyGoal()] })}
            disabled={form.goals.length >= 20}
          >
            <Plus size={14} /> Add goal
          </Button>
        </div>

        {!plan && (
          <Field label="Overall rating (needed to share)" htmlFor="review-rating">
            <Select
              id="review-rating"
              value={form.rating}
              onChange={change('rating')}
              options={[
                { value: '', label: 'Choose…' },
                ...ratingOptions.map((option) => ({
                  value: option.value,
                  label: `${option.value} · ${option.label}`,
                })),
              ]}
            />
          </Field>
        )}
        <Field label={plan ? 'Why this plan' : 'What went well'} htmlFor="review-strengths">
          <textarea
            id="review-strengths"
            className={`${inputClass} min-h-20`}
            value={form.strengths}
            onChange={change('strengths')}
            maxLength={2000}
          />
        </Field>
        <Field
          label={plan ? 'What must change, and how it will be checked' : 'What to improve'}
          htmlFor="review-improvements"
        >
          <textarea
            id="review-improvements"
            className={`${inputClass} min-h-20`}
            value={form.improvements}
            onChange={change('improvements')}
            maxLength={2000}
          />
        </Field>
        <Field label="Training or support planned" htmlFor="review-training">
          <textarea
            id="review-training"
            className={`${inputClass} min-h-16`}
            value={form.training}
            onChange={change('training')}
            maxLength={1000}
          />
        </Field>
        {error && <ErrorText>{error}</ErrorText>}
        <div className="flex justify-end gap-2">
          <ButtonLink
            variant="secondary"
            href={review ? `/performance/${review._id}` : '/performance'}
          >
            Cancel
          </ButtonLink>
          <Button type="submit" disabled={busy || (!review && !userId)}>
            Save draft
          </Button>
        </div>
      </form>
    </Card>
  );
}
