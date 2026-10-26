import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { getMyDay } from '@/server/services/attendance.service.js';
import { PageHeader } from '@/components/shared/ui.jsx';
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
    </>
  );
}
