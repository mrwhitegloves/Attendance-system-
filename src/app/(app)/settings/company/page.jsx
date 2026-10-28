import { requirePageUser } from '@/server/auth/current.js';
import { getCompany } from '@/server/services/settings.service.js';
import { PageHeader } from '@/components/shared/ui.jsx';
import { SettingsTabs } from '@/features/settings/SettingsTabs.jsx';
import { CompanyForm } from '@/features/settings/CompanyForm.jsx';

export const metadata = { title: 'Company' };

export default async function CompanyPage() {
  await requirePageUser('settings.manage');
  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="These details are printed on letters and salary slips."
      />
      <SettingsTabs active="company" />
      <CompanyForm company={await getCompany({ withStamp: true })} />
    </>
  );
}
