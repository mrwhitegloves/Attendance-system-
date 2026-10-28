import { requirePageUser } from '@/server/auth/current.js';
import { REQUEST_KIND_KEYS } from '@/config/requestKinds.js';
import { PageHeader } from '@/components/shared/ui.jsx';
import { RequestForm } from '@/features/requests/RequestForm.jsx';

export const metadata = { title: 'New request' };

export default async function NewRequestPage({ searchParams }) {
  await requirePageUser('requests.create');
  const { kind } = await searchParams;
  return (
    <>
      <PageHeader
        title="New request"
        subtitle="It goes to HR. You get a notification when it is decided."
      />
      <RequestForm initialKind={REQUEST_KIND_KEYS.includes(kind) ? kind : REQUEST_KIND_KEYS[0]} />
    </>
  );
}
