import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { can } from '@/server/permissions/can.js';
import { assetCounts, listAssets } from '@/server/services/assets.service.js';
import { listAssetsQuery } from '@/server/validation/schemas.js';
import { PageHeader } from '@/components/shared/ui.jsx';
import { AssetList } from '@/features/assets/AssetList.jsx';

export const metadata = { title: 'Assets' };

export default async function AssetsPage({ searchParams }) {
  const user = await requirePageUser('assets.view');
  const parsed = listAssetsQuery.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : listAssetsQuery.parse({});
  const [result, counts] = await Promise.all([listAssets(user, query), assetCounts(user)]);
  const scope = can(user, 'assets.view');
  return (
    <>
      <PageHeader
        title={scope === 'own' ? 'My assets' : 'Assets'}
        subtitle={
          scope === 'own'
            ? 'Company things you have. Return them when you leave.'
            : 'Laptops, phones, ID cards and kits, and who has each.'
        }
      />
      <AssetList
        result={toPlain(result)}
        counts={counts}
        canManage={Boolean(can(user, 'assets.manage'))}
        showPerson={scope !== 'own'}
      />
    </>
  );
}
