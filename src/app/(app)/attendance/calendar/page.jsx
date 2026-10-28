import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { can } from '@/server/permissions/can.js';
import { getMonthCalendar } from '@/server/services/attendance.service.js';
import { monthQuery } from '@/server/validation/schemas.js';
import { PageHeader } from '@/components/shared/ui.jsx';
import { AttendanceTabs } from '@/features/attendance/AttendanceTabs.jsx';
import { MonthCalendar } from '@/features/attendance/MonthCalendar.jsx';

export const metadata = { title: 'My month' };

export default async function MyMonthPage({ searchParams }) {
  const user = await requirePageUser('attendance.punch');
  const parsed = monthQuery.safeParse(await searchParams);
  const calendar = await getMonthCalendar(
    user,
    user._id,
    parsed.success ? parsed.data.month : undefined,
  );
  return (
    <>
      <PageHeader title="Attendance" />
      <AttendanceTabs active="calendar" scope={can(user, 'attendance.view')} canPunch />
      <MonthCalendar calendar={toPlain(calendar)} />
    </>
  );
}
