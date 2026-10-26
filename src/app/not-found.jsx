import { ButtonLink } from '@/components/shared/ui.jsx';

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-4xl font-semibold text-brand">404</p>
      <p className="text-sm text-muted">
        This page does not exist, or you do not have access to it.
      </p>
      <ButtonLink href="/dashboard" variant="secondary">
        Go to the dashboard
      </ButtonLink>
    </main>
  );
}
