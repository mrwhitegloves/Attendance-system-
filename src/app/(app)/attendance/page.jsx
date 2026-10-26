import { redirect } from 'next/navigation';
import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { can } from '@/server/permissions/can.js';
import { getDailySheet } from '@/server/services/attendance.service.js';
import { dayQuery } from '@/server/validation/schemas.js';
import { indiaDay } from '@/server/lib/dates.js';
import { PageHeader } from '@/components/shared/ui.jsx';
import { AttendanceTabs } from '@/features/attendance/AttendanceTabs.jsx';
import { DaySheet } from '@/features/attendance/DaySheet.jsx';

export const metadata = { title: 'Attendance' };

export default async function AttendancePage({ searchParams }) {
  const user = await requirePageUser('attendance.view');
  const scope = can(user, 'attendance.view');
  if (scope === 'own') redirect('/attendance/calendar');
  const parsed = dayQuery.safeParse(await searchParams);
  const date = (parsed.success && parsed.data.date) || indiaDay();
  const sheet = await getDailySheet(user, date);
  return (
    <>
      <PageHeader title="Attendance" subtitle={scope === 'team' ? 'Your team' : 'Everyone'} />
      <AttendanceTabs
        active="day"
        scope={scope}
        canPunch={Boolean(can(user, 'attendance.punch'))}
      />
      <DaySheet sheet={toPlain(sheet)} today={indiaDay()} />
    </>
  );
}
