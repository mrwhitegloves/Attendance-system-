import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { can } from '@/server/permissions/can.js';
import { getDailySheet, getMyDay, getMyRecentDays } from '@/server/services/attendance.service.js';
import { countPendingLeaves } from '@/server/services/leaves.service.js';
import { PageHeader } from '@/components/shared/ui.jsx';
import { MyDayCard } from '@/features/dashboard/MyDayCard.jsx';
import { RecentDays } from '@/features/dashboard/RecentDays.jsx';
import { PunchScreen } from '@/features/attendance/PunchScreen.jsx';
import { TeamToday } from '@/features/dashboard/TeamToday.jsx';
import { BroadcastButton } from '@/features/notifications/BroadcastButton.jsx';
import { InstallBanner } from '@/features/notifications/InstallBanner.jsx';
import { getControlCenter } from '@/server/services/dashboard.service.js';
import { ControlCenter } from '@/features/dashboard/ControlCenter.jsx';

export const metadata = { title: 'Dashboard' };

function greeting() {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'Asia/Kolkata',
    }).format(new Date()),
  );
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

export default async function DashboardPage() {
  const user = await requirePageUser();
  const scope = can(user, 'attendance.view');
  const punches = Boolean(can(user, 'attendance.punch'));
  // An employee who sees only their own attendance punches right here (founder, 2026-10-29).
  const ownOnly = punches && (!scope || scope === 'own');
  const [myDay, sheet, pending, control, recent] = await Promise.all([
    punches ? getMyDay(user) : null,
    scope && scope !== 'own' ? getDailySheet(user) : null,
    countPendingLeaves(user),
    getControlCenter(user),
    ownOnly ? getMyRecentDays(user, 7) : null,
  ]);
  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user.name.split(' ')[0]}`}
        subtitle={
          scope === 'all'
            ? 'Here is how the company is doing today.'
            : scope === 'team'
              ? 'Here is your team today.'
              : 'Here is your day.'
        }
        actions={can(user, 'notifications.broadcast') && <BroadcastButton />}
      />
      <div className="space-y-5">
        <InstallBanner />
        {control && <ControlCenter data={toPlain(control)} />}
        {myDay && ownOnly && <PunchScreen day={toPlain(myDay)} />}
        {myDay && !ownOnly && <MyDayCard day={toPlain(myDay)} />}
        {recent && <RecentDays days={toPlain(recent)} />}
        {control && sheet && <h2 className="pt-2 text-sm font-semibold">Attendance today</h2>}
        {sheet && <TeamToday sheet={toPlain(sheet)} pendingLeaves={pending} />}
      </div>
    </>
  );
}
