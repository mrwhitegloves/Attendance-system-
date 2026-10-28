import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { can } from '@/server/permissions/can.js';
import { listAttendance } from '@/server/services/attendance.service.js';
import { listUserOptions } from '@/server/services/users.service.js';
import { listAttendanceQuery } from '@/server/validation/schemas.js';
import { PageHeader } from '@/components/shared/ui.jsx';
import { AttendanceTabs } from '@/features/attendance/AttendanceTabs.jsx';
import { RecordsList } from '@/features/attendance/RecordsList.jsx';

export const metadata = { title: 'Punches' };

export default async function RecordsPage({ searchParams }) {
  const user = await requirePageUser('attendance.view');
  const scope = can(user, 'attendance.view');
  const parsed = listAttendanceQuery.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : listAttendanceQuery.parse({});
  const [result, people] = await Promise.all([
    listAttendance(user, query),
    scope === 'own' ? [] : listUserOptions(user, 'attendance.view'),
  ]);
  return (
    <>
      <PageHeader title="Attendance" />
      <AttendanceTabs
        active="records"
        scope={scope}
        canPunch={Boolean(can(user, 'attendance.punch'))}
      />
      <RecordsList result={toPlain(result)} people={toPlain(people)} showPerson={scope !== 'own'} />
    </>
  );
}
