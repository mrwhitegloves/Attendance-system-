// Form fields. `inputClass` for form fields, `compactInputClass` for filters in a bar.

export const inputClass =
  'h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-60';

export const compactInputClass =
  'h-9 rounded-lg border border-border bg-surface px-2.5 text-sm text-text focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

export function Field({ label, htmlFor, hint, error, children }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Select({ options, className = inputClass, ...props }) {
  return (
    <select className={className} {...props}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
