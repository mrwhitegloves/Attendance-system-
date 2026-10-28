// Performance reviews and improvement plans (CEO spec: "targets, KPIs, manager reviews,
// training and improvement plans"), and the words the screens show.

export const REVIEW_KINDS = {
  review: 'Performance review',
  improvement_plan: 'Improvement plan',
};

export const REVIEW_STATUS = {
  draft: { label: 'Draft', tone: 'neutral' },
  shared: { label: 'Shared, waiting for the employee', tone: 'info' },
  acknowledged: { label: 'Seen by the employee', tone: 'success' },
};

export const REVIEW_STATUSES = Object.keys(REVIEW_STATUS);

export const RATINGS = {
  1: 'Needs improvement',
  2: 'Below expectations',
  3: 'Meets expectations',
  4: 'Exceeds expectations',
  5: 'Outstanding',
};

// The result of an improvement plan, written by the reviewer at the end.
export const PLAN_OUTCOMES = {
  met: 'Goals met',
  extended: 'Plan extended',
  not_met: 'Goals not met',
};

const toList = (labels) => Object.entries(labels).map(([value, label]) => ({ value, label }));
export const reviewKindOptions = toList(REVIEW_KINDS);
export const ratingOptions = toList(RATINGS);
export const planOutcomeOptions = toList(PLAN_OUTCOMES);
