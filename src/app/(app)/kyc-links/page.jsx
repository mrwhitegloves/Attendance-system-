import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { listKycLinks } from '@/server/services/kycLinks.service.js';
import { listUserOptions } from '@/server/services/users.service.js';
import { listKycLinksQuery } from '@/server/validation/schemas.js';
import { PageHeader } from '@/components/shared/ui.jsx';
import { KycLinkList } from '@/features/kycLinks/KycLinkList.jsx';

export const metadata = { title: 'Employee KYC' };

export default async function KycLinksPage({ searchParams }) {
  const user = await requirePageUser('users.manage');
  const parsed = listKycLinksQuery.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : listKycLinksQuery.parse({});
  const [result, employees] = await Promise.all([
    listKycLinks(user, query),
    listUserOptions(user, 'users.view', { notActiveYet: true }),
  ]);
  return (
    <>
      <PageHeader
        title="Employee KYC"
        subtitle="Send a link; what the employee fills in goes straight into their file, KYC and documents."
      />
      <KycLinkList result={toPlain(result)} employees={toPlain(employees)} />
    </>
  );
}
