import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { can } from '@/server/permissions/can.js';
import { listPayslips } from '@/server/services/payslips.service.js';
import { PayslipList } from '@/features/payslips/PayslipList.jsx';

export const metadata = { title: 'Employee salary slips' };

export default async function EmployeePayslipsPage({ params }) {
  const user = await requirePageUser('payslips.view');
  const { id } = await params;
  const result = await listPayslips(user, { userId: id, page: 1 });
  return (
    <PayslipList
      result={toPlain(result)}
      userId={id}
      canCreate={Boolean(can(user, 'payslips.manage'))}
      showFilters={false}
      showPerson={false}
    />
  );
}
