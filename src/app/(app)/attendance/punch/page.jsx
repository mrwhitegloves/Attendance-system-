import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { getMyDay } from '@/server/services/attendance.service.js';
import { PageHeader } from '@/components/shared/ui.jsx';
import Link from 'next/link';
import { can } from '@/server/permissions/can.js';
import { PunchScreen } from '@/features/attendance/PunchScreen.jsx';

export const metadata = { title: 'Punch' };

export default async function PunchPage() {
  const user = await requirePageUser('attendance.punch');
  const day = await getMyDay(user);
  return (
    <>
      <PageHeader
        title="Punch in / out"
        subtitle="A photo and your location are saved with every punch."
      />
      <PunchScreen day={toPlain(day)} />
      {can(user, 'requests.create') && (
        <p className="mt-4 text-center text-sm text-muted">
          Forgot to punch on an earlier day?{' '}
          <Link href="/requests/new?kind=regularization" className="text-brand hover:underline">
            Ask HR to add a missed punch
          </Link>
        </p>
      )}
    </>
  );
}
