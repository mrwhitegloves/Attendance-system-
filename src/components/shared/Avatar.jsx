// The person's photo (a short-lived signed link), or initials on a colour picked from the name.
// No outside avatar service.

const COLOURS = ['bg-brand', 'bg-info', 'bg-success', 'bg-warning', 'bg-muted'];
const SIZES = {
  sm: 'h-7 w-7 text-[11px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-14 w-14 text-lg',
  xl: 'h-20 w-20 text-2xl',
};

export function Avatar({ name = '', src = null, size = 'md' }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className={`shrink-0 rounded-full object-cover ${SIZES[size]}`} />
    );
  }
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
  const colour =
    COLOURS[[...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % COLOURS.length];
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${colour} ${SIZES[size]}`}
    >
      {initials || '?'}
    </span>
  );
}

/** Avatar with name and employee ID. */
export function PersonCell({ name, employeeId, sub, photoUrl }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Avatar name={name} src={photoUrl} size="sm" />
      <span className="min-w-0">
        <span className="block truncate font-medium">{name}</span>
        <span className="block truncate text-xs text-muted">
          {[employeeId, sub].filter(Boolean).join(' · ')}
        </span>
      </span>
    </span>
  );
}

/** A thin bar for how complete an employee's file is. */
export function CompletenessBar({ percent, showLabel = true }) {
  const tone = percent >= 100 ? 'bg-success' : percent >= 60 ? 'bg-warning' : 'bg-danger';
  return (
    <span className="flex items-center gap-2" title={`File ${percent}% complete`}>
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-raised">
        <span className={`block h-full rounded-full ${tone}`} style={{ width: `${percent}%` }} />
      </span>
      {showLabel && <span className="text-xs tabular-nums text-muted">{percent}%</span>}
    </span>
  );
}
