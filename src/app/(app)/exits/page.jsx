import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { can } from '@/server/permissions/can.js';
import { listExits } from '@/server/services/exits.service.js';
import { listExitsQuery } from '@/server/validation/schemas.js';
import { PageHeader } from '@/components/shared/ui.jsx';
import { LifecycleTabs, lifecycleShow } from '@/features/recruitment/LifecycleTabs.jsx';
import { ExitList } from '@/features/exits/ExitList.jsx';

export const metadata = { title: 'Exits' };

export default async function ExitsPage({ searchParams }) {
  const user = await requirePageUser('exits.view');
  const parsed = listExitsQuery.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : listExitsQuery.parse({});
  const result = await listExits(user, query);
  return (
    <>
      <PageHeader
        title="Exits"
        subtitle="Resignations and notice periods. Start an exit from the employee's Exit tab."
      />
      <LifecycleTabs active="exits" show={lifecycleShow(can, user)} />
      <ExitList result={toPlain(result)} />
    </>
  );
}
