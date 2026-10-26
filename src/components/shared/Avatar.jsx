// Initials on a colour picked from the name. No outside avatar service.

const COLOURS = ['bg-brand', 'bg-info', 'bg-success', 'bg-warning', 'bg-muted'];

export function Avatar({ name = '', size = 'md' }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
  const colour =
    COLOURS[[...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % COLOURS.length];
  const sizes = { sm: 'h-7 w-7 text-[11px]', md: 'h-9 w-9 text-xs', lg: 'h-14 w-14 text-lg' };
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${colour} ${sizes[size]}`}
    >
      {initials || '?'}
    </span>
  );
}

/** Avatar with name and employee ID. */
export function PersonCell({ name, employeeId, sub }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Avatar name={name} size="sm" />
      <span className="min-w-0">
        <span className="block truncate font-medium">{name}</span>
        <span className="block truncate text-xs text-muted">
          {[employeeId, sub].filter(Boolean).join(' · ')}
        </span>
      </span>
    </span>
  );
}
