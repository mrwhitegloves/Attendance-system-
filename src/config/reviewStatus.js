// Status words and badge colours for anything that is checked: KYC items and documents
// (CEO spec: Missing, Submitted, Under review, Verified, Rejected, Expired).

export const REVIEW_STATUS = {
  missing: { label: 'Missing', tone: 'neutral' },
  submitted: { label: 'Submitted', tone: 'info' },
  under_review: { label: 'Under review', tone: 'warning' },
  verified: { label: 'Verified', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
  expired: { label: 'Expired', tone: 'danger' },
};

export const SIGNATURE_STATUS = {
  not_needed: null,
  pending: { label: 'Not signed yet', tone: 'warning' },
  signed: { label: 'Signed', tone: 'success' },
};
