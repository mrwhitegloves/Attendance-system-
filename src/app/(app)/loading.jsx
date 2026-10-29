// Shown at once when a screen is opened, while the server prepares it (no blank wait on click).
export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-7 w-48 rounded-lg bg-border" />
      <div className="h-4 w-72 max-w-full rounded bg-border/70" />
      <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="h-5 rounded bg-border/60" />
        ))}
      </div>
    </div>
  );
}
