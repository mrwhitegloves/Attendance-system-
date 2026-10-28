import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { can } from '@/server/permissions/can.js';
import { getMonthCalendar } from '@/server/services/attendance.service.js';
import { listCompOffs } from '@/server/services/leaveRules.service.js';
import { monthQuery } from '@/server/validation/schemas.js';
import { MonthCalendar } from '@/features/attendance/MonthCalendar.jsx';
import { CompOffs } from '@/features/attendance/CompOffs.jsx';

export const metadata = { title: 'Employee attendance' };

export default async function EmployeeAttendancePage({ params, searchParams }) {
  const user = await requirePageUser('attendance.view');
  const { id } = await params;
  const parsed = monthQuery.safeParse(await searchParams);
  const calendar = await getMonthCalendar(user, id, parsed.success ? parsed.data.month : undefined);
  const compOffs = can(user, 'leave.view') ? await listCompOffs(user, id).catch(() => null) : null;
  return (
    <div className="space-y-4">
      <MonthCalendar calendar={toPlain(calendar)} />
      {compOffs && (
        <CompOffs
          userId={id}
          items={toPlain(compOffs)}
          canManage={Boolean(can(user, 'leave.decide'))}
        />
      )}
    </div>
  );
}
