import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { listAuditLog } from '@/server/services/audit.service.js';
import { auditQuery } from '@/server/validation/schemas.js';
import { Card, PageHeader } from '@/components/shared/ui.jsx';
import { AuditList } from '@/features/auth/AuditList.jsx';

export const metadata = { title: 'Audit log' };

export default async function AuditLogPage({ searchParams }) {
  await requirePageUser('audit.view');
  const parsed = auditQuery.safeParse(await searchParams);
  const result = await listAuditLog(parsed.success ? parsed.data : auditQuery.parse({}));
  return (
    <>
      <PageHeader title="Audit log" subtitle="Who changed what, and when." />
      <Card>
        <AuditList result={toPlain(result)} />
      </Card>
    </>
  );
}
