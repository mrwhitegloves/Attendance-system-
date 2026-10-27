// Ways an employee leaves, and the words the exit screens show.

export const EXIT_TYPES = {
  resignation: 'Resignation',
  termination: 'Termination',
  absconding: 'Absconding (stopped coming)',
  retirement: 'Retirement',
  contract_end: 'End of contract or internship',
  other: 'Other',
};

export const EXIT_STATUS = {
  notice: { label: 'Notice period', tone: 'warning' },
  completed: { label: 'Exited', tone: 'neutral' },
  withdrawn: { label: 'Withdrawn', tone: 'info' },
};

export const EXIT_STATUSES = Object.keys(EXIT_STATUS);

export const exitTypeOptions = Object.entries(EXIT_TYPES).map(([value, label]) => ({
  value,
  label,
}));
