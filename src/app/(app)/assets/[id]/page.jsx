import { notFound } from 'next/navigation';
import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { can } from '@/server/permissions/can.js';
import { getAsset } from '@/server/services/assets.service.js';
import { listUserOptions } from '@/server/services/users.service.js';
import { AssetDetail } from '@/features/assets/AssetDetail.jsx';

export const metadata = { title: 'Asset' };

export default async function AssetPage({ params }) {
  const user = await requirePageUser('assets.view');
  const { id } = await params;
  const asset = await getAsset(user, id).catch((error) => {
    if (error.status === 404) notFound();
    throw error;
  });
  const canManage = Boolean(can(user, 'assets.manage'));
  const people = canManage ? await listUserOptions(user, 'assets.view') : [];
  return <AssetDetail asset={toPlain(asset)} people={toPlain(people)} canManage={canManage} />;
}
