import { describe, expect, it } from 'vitest';
import { getMyRecentDays } from '@/server/services/attendance.service.js';
import { Attendance } from '@/server/models/attendance.model.js';
import { at, makeUser } from './helpers.js';

describe('dashboard: last 7 days', () => {
  it('lists the own last 7 days, newest first, with punches, status and hours', async () => {
    const staff = await makeUser({ weeklyOffs: [0] });
    await Attendance.insertMany([
      { employeeId: staff.employeeId, date: '2026-10-27', time: '09:40', status: 'Late' },
      { employeeId: staff.employeeId, date: '2026-10-27', time: '18:40', status: 'Checked Out' },
      { employeeId: staff.employeeId, date: '2026-10-28', time: '09:20 AM', status: 'Checked In' },
      // Someone else's punch never shows.
      { employeeId: 'MWG-999', date: '2026-10-28', time: '09:00 AM', status: 'Checked In' },
    ]);
    const days = await getMyRecentDays(staff, 7, at('2026-10-29', '12:00'));
    expect(days.map((day) => day.date)).toEqual([
      '2026-10-29',
      '2026-10-28',
      '2026-10-27',
      '2026-10-26',
      '2026-10-25',
      '2026-10-24',
      '2026-10-23',
    ]);
    expect(days[2]).toMatchObject({ status: 'Late', minutesWorked: 9 * 60 });
    expect(days[2].punchIn.time).toBe('09:40');
    expect(days[1]).toMatchObject({ status: 'Present', minutesWorked: null });
    expect(days[1].punchOut).toBeNull();
    // 25 Oct 2026 is a Sunday: the weekly off.
    expect(days[4].status).toBe('Weekly off');
    expect(days[3].status).toBe('No punch');
  });
});
