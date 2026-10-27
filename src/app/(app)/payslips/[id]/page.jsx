import Link from 'next/link';
import { requirePageUser, toPlain } from '@/server/auth/current.js';
import { getPayslip } from '@/server/services/payslips.service.js';
import { PayslipEditor } from '@/features/payslips/PayslipEditor.jsx';

export const metadata = { title: 'Salary slip' };

export default async function PayslipPage({ params }) {
  const user = await requirePageUser('payslips.view');
  const { id } = await params;
  const slip = await getPayslip(user, id);
  const isOwn = String(slip.userId) === String(user._id);
  return (
    <>
      <p className="mb-2 text-sm">
        <Link
          href={isOwn ? '/me' : `/employees/${slip.userId}/payslips`}
          className="text-brand underline"
        >
          ← {isOwn ? 'My profile' : `${slip.employee.name}'s salary slips`}
        </Link>
      </p>
      <PayslipEditor slip={toPlain(slip)} />
    </>
  );
}
