import Link from 'next/link';
import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { assetsWith } from '@/server/services/assets.service.js';
import { ASSET_CATEGORIES } from '@/config/assetOptions.js';
import { formatDateTime } from '@/lib/format.js';
import { Card, CardHeader, EmptyState } from '@/components/shared/ui.jsx';

export const metadata = { title: 'Employee assets' };

export default async function EmployeeAssetsPage({ params }) {
  const user = await requirePageUser('assets.view');
  const { id } = await params;
  const items = toPlain(await assetsWith(user, id));
  return (
    <Card>
      <CardHeader
        title="Company assets with this employee"
        subtitle="Hand over or take back from the asset's own page (Assets)."
      />
      {items.length === 0 ? (
        <EmptyState title="Nothing with this employee" />
      ) : (
        <ul className="divide-y divide-border">
          {items.map((asset) => (
            <li key={asset._id}>
              <Link
                href={`/assets/${asset._id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-raised"
              >
                <span>
                  <span className="font-medium">{asset.name}</span>{' '}
                  <span className="text-xs text-muted">
                    {asset.code} · {ASSET_CATEGORIES[asset.category]}
                    {asset.serialNumber ? ` · ${asset.serialNumber}` : ''}
                  </span>
                </span>
                <span className="text-xs text-muted">Since {formatDateTime(asset.assignedAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
