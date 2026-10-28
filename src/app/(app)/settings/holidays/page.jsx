import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { listHolidays } from '@/server/services/leaveRules.service.js';
import { HOLIDAY_KINDS } from '@/server/models/leaveRules.model.js';
import { indiaDay } from '@/server/lib/dates.js';
import { PageHeader } from '@/components/shared/ui.jsx';
import { SettingsTabs } from '@/features/settings/SettingsTabs.jsx';
import { HolidaysManager } from '@/features/settings/HolidaysManager.jsx';

export const metadata = { title: 'Holidays' };

export default async function HolidaysPage({ searchParams }) {
  await requirePageUser('settings.manage');
  const asked = Number((await searchParams).year);
  const year = asked >= 2020 && asked <= 2100 ? asked : Number(indiaDay().slice(0, 4));
  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Occasions, festivals and national holidays. A holiday is a paid day for everyone: no salary is cut."
      />
      <SettingsTabs active="holidays" />
      <HolidaysManager
        year={year}
        holidays={toPlain(await listHolidays(year))}
        kinds={Object.entries(HOLIDAY_KINDS).map(([value, label]) => ({ value, label }))}
      />
    </>
  );
}
