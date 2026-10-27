// Words of the letters screens, in one place.

export const LETTER_KIND_LABELS = {
  offer: 'Offer letter',
  appointment: 'Appointment letter',
  salary_revision: 'Salary revision letter',
  confirmation: 'Confirmation letter',
  relieving: 'Relieving letter',
  experience: 'Experience letter',
  other: 'Other letter',
};

export const LETTER_STATUS = {
  draft: { label: 'Draft', tone: 'neutral' },
  issued: { label: 'Issued, waiting for reply', tone: 'info' },
  accepted: { label: 'Accepted', tone: 'success' },
  declined: { label: 'Declined', tone: 'danger' },
  superseded: { label: 'Replaced by a newer version', tone: 'neutral' },
};

export const letterTitle = (letter) =>
  `${LETTER_KIND_LABELS[letter.kind] ?? 'Letter'} v${letter.version}`;
