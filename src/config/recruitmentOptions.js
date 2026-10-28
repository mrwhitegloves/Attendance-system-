// Candidates (people HR wants to hire) and the words the screens show.

export const CANDIDATE_STATUS = {
  open: { label: 'Open', tone: 'info' },
  joined: { label: 'Joined', tone: 'success' },
  dropped: { label: 'Not joining', tone: 'neutral' },
};

export const CANDIDATE_STATUSES = Object.keys(CANDIDATE_STATUS);

export const DROP_REASONS = {
  declined: 'Declined the offer',
  withdrawn: 'Offer withdrawn by the company',
  no_show: 'Did not join',
  other: 'Other',
};

export const dropReasonOptions = Object.entries(DROP_REASONS).map(([value, label]) => ({
  value,
  label,
}));
