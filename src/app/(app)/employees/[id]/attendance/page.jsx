import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { getMonthCalendar } from '@/server/services/attendance.service.js';
import { monthQuery } from '@/server/validation/schemas.js';
import { MonthCalendar } from '@/features/attendance/MonthCalendar.jsx';

export const metadata = { title: 'Employee attendance' };

export default async function EmployeeAttendancePage({ params, searchParams }) {
  const user = await requirePageUser('attendance.view');
  const { id } = await params;
  const parsed = monthQuery.safeParse(await searchParams);
  const calendar = await getMonthCalendar(user, id, parsed.success ? parsed.data.month : undefined);
  return <MonthCalendar calendar={toPlain(calendar)} />;
}
