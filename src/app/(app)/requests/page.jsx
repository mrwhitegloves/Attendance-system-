import { notFound } from 'next/navigation';
import { Plus } from 'lucide-react';
import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { can } from '@/server/permissions/can.js';
import {
  countRequestsToDecide,
  listRequests,
  otherApprovals,
} from '@/server/services/requests.service.js';
import { listRequestsQuery } from '@/server/validation/schemas.js';
import { ButtonLink, PageHeader } from '@/components/shared/ui.jsx';
import { LinkTabs } from '@/components/shared/Tabs.jsx';
import { RequestList } from '@/features/requests/RequestList.jsx';
import { OtherApprovals } from '@/features/requests/OtherApprovals.jsx';

export const metadata = { title: 'Requests' };

export default async function RequestsPage({ searchParams }) {
  const user = await requirePageUser();
  const canCreate = Boolean(can(user, 'requests.create'));
  const canDecide = Boolean(can(user, 'requests.decide'));
  const viewScope = can(user, 'requests.view');
  const params = await searchParams;
  // Deciders open on what waits for them; everyone else on their own requests.
  const parsed = listRequestsQuery.safeParse({ box: canDecide ? 'decide' : 'mine', ...params });
  const query = parsed.success ? parsed.data : listRequestsQuery.parse({});
  if (query.box === 'decide' && !canDecide) notFound();
  if (query.box === 'all' && (!viewScope || viewScope === 'own')) notFound();
  if (query.box === 'mine' && !canCreate && !viewScope) notFound();
  if (query.box === 'decide' && !params.status) query.status = 'pending';

  const [result, waiting, others] = await Promise.all([
    listRequests(user, query),
    countRequestsToDecide(user),
    query.box === 'decide' ? otherApprovals(user) : [],
  ]);

  const tabs = [
    canDecide && {
      id: 'decide',
      label: waiting ? `To approve (${waiting})` : 'To approve',
      href: '/requests?box=decide',
    },
    (canCreate || viewScope) && { id: 'mine', label: 'My requests', href: '/requests?box=mine' },
    viewScope &&
      viewScope !== 'own' && {
        id: 'all',
        label: viewScope === 'team' ? 'My team' : 'All requests',
        href: '/requests?box=all',
      },
  ].filter(Boolean);

  return (
    <>
      <PageHeader
        title="Requests"
        subtitle="Expense claims, salary advances, document requests and grievances."
        actions={
          canCreate && (
            <ButtonLink href="/requests/new">
              <Plus size={16} /> New request
            </ButtonLink>
          )
        }
      />
      {tabs.length > 1 && <LinkTabs tabs={tabs} active={query.box} />}
      {query.box === 'decide' && <OtherApprovals items={others} />}
      <RequestList result={toPlain(result)} box={query.box} showPerson={query.box !== 'mine'} />
    </>
  );
}
