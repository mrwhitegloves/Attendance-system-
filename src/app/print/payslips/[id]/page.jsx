import Image from 'next/image';
import { requirePageUser } from '@/server/auth/current.js';
import { getPayslip } from '@/server/services/payslips.service.js';
import { BRANDING } from '@/config/branding.js';
import { ATTENDANCE_SUMMARY, DEDUCTIONS, EARNINGS } from '@/config/payslipFields.js';
import { PrintButton } from '@/features/letters/PrintButton.jsx';

export const metadata = { title: 'Salary slip' };

const AMOUNT = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const amount = (paise) => AMOUNT.format((paise ?? 0) / 100);
const MONTH = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const DAY = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const monthName = (month) => MONTH.format(new Date(`${month}-01T00:00:00Z`));
const longDay = (day) => (day ? DAY.format(new Date(`${day}T00:00:00Z`)) : '—');

// The MWG salary slip on an A4 page, for printing or "Save as PDF". Always light colours.
export default async function PrintPayslipPage({ params }) {
  const user = await requirePageUser('payslips.view');
  const { id } = await params;
  const slip = await getPayslip(user, id, { full: true, withStamp: true });
  const { company, employee } = slip;
  const brand = [company.brandName, company.tagline].filter(Boolean);

  const lines = (list, values) =>
    list.map((line) => ({ label: line.label, value: values[line.key] ?? 0 }));
  const earnings = lines(EARNINGS, slip.earnings);
  const deductions = lines(DEDUCTIONS, slip.deductions);
  const rowCount = Math.max(earnings.length, deductions.length);

  const table = (title, rows, total, headerClass) => (
    <div className="overflow-hidden rounded-md border border-gray-200">
      <div
        className={`flex justify-between px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-white ${headerClass}`}
      >
        <span>{title}</span>
        <span>Amount (₹)</span>
      </div>
      {Array.from({ length: rowCount }, (_, index) => rows[index] ?? null).map((row, index) => (
        <div
          key={index}
          className={`flex h-[21px] items-center justify-between px-3 text-[10px] ${index % 2 ? 'bg-gray-50' : 'bg-white'}`}
        >
          <span>{row?.label ?? ''}</span>
          <span className="tabular-nums">{row ? (row.value ? amount(row.value) : '–') : ''}</span>
        </div>
      ))}
      <div className="flex justify-between border-t border-gray-300 px-3 py-2 text-[11px] font-bold">
        <span>Total {title === 'Earnings' ? 'Earnings' : 'Deductions'}</span>
        <span className="tabular-nums">{amount(total)}</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 text-black print:bg-white">
      <style>
        {
          '@page { size: A4; margin: 8mm; } @media print { .no-print { display: none !important; } } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }'
        }
      </style>
      <div className="no-print flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-6 py-3 text-sm text-gray-700">
        <span>
          {slip.status === 'draft'
            ? 'Draft: not final yet.'
            : 'Use “Save as PDF” in the print window to keep a PDF.'}
        </span>
        <PrintButton />
      </div>

      <article className="relative mx-auto my-6 w-[194mm] bg-white shadow print:my-0 print:shadow-none">
        {slip.status === 'draft' && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[110px] font-black tracking-widest text-gray-200/70 [transform:rotate(-30deg)]">
            DRAFT
          </span>
        )}
        {/* Header */}
        <header className="flex items-center justify-between bg-black px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <Image src={BRANDING.logo} alt="" width={52} height={52} className="rounded" />
            <div className="leading-tight">
              <p className="text-xl font-extrabold tracking-wide">{brand[0] ?? company.name}</p>
              {brand[1] && (
                <p className="text-xs font-bold tracking-wider text-brand">{brand[1]}</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-extrabold tracking-wide">SALARY SLIP</p>
            <p className="text-sm font-semibold uppercase text-brand">
              For the month of {monthName(slip.month)}
            </p>
          </div>
        </header>
        <div className="h-1 bg-brand" />

        <div className="space-y-4 px-6 py-5">
          {/* Company */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-base font-bold">{company.name}</p>
              {company.address && (
                <p className="whitespace-pre-line text-[10px] text-gray-500">{company.address}</p>
              )}
              {company.gstNumber && (
                <p className="text-[10px] text-gray-500">
                  GST Registration No: {company.gstNumber}
                </p>
              )}
            </div>
            {company.website && <p className="text-[10px] text-gray-500">{company.website}</p>}
          </div>

          {/* Employee details */}
          <section className="rounded-md border border-gray-200 border-l-4 border-l-brand bg-gray-50 px-4 py-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-brand">
              Employee details
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[10.5px]">
              {[
                ['Employee Name', employee.name, 'PAN', employee.pan || '—'],
                ['Employee Code', employee.code, 'Bank Name', employee.bankName || '—'],
                [
                  'Designation',
                  employee.designation || '—',
                  'Bank Account No.',
                  employee.account || '—',
                ],
                [
                  'Date of Joining',
                  longDay(employee.joiningDate),
                  'Pay Period',
                  monthName(slip.month),
                ],
              ].map(([leftLabel, leftValue, rightLabel, rightValue]) => [
                <div key={leftLabel} className="flex gap-3">
                  <span className="w-28 text-gray-500">{leftLabel}</span>
                  <span className="font-bold">{leftValue}</span>
                </div>,
                <div key={rightLabel} className="flex gap-3">
                  <span className="w-28 text-gray-500">{rightLabel}</span>
                  <span className="font-bold">{rightValue}</span>
                </div>,
              ])}
            </div>
          </section>

          {/* Attendance */}
          <div className="grid grid-cols-5 gap-2">
            {ATTENDANCE_SUMMARY.map((line) => (
              <div
                key={line.key}
                className="rounded-md border border-gray-200 px-2 py-2 text-center"
              >
                <p className="text-xl font-bold">{slip.attendance[line.key] ?? 0}</p>
                <p className="text-[8.5px] uppercase tracking-wide text-gray-500">{line.label}</p>
              </div>
            ))}
          </div>

          {/* Earnings and deductions */}
          <div className="grid grid-cols-2 gap-4">
            {table('Earnings', earnings, slip.totals.earnings, 'bg-black')}
            {table('Deductions', deductions, slip.totals.deductions, 'bg-brand')}
          </div>

          {/* Net pay */}
          <section className="flex items-center justify-between rounded-md border-l-4 border-l-brand bg-black px-5 py-4 text-white">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-300">
                Net salary payable
              </p>
              <p className="text-[11px] italic text-gray-200">{slip.netInWords}</p>
            </div>
            <p className="text-3xl font-extrabold tabular-nums">₹ {amount(slip.totals.net)}</p>
          </section>

          {/* Signatures */}
          <div className="flex items-end justify-between gap-6 pt-2">
            <div className="w-56">
              <div className="h-24" />
              <div className="border-t border-gray-400 pt-1 text-[10px] font-bold">
                Employee Signature
              </div>
            </div>
            <div className="w-64">
              <div className="flex h-24 items-end">
                {company.stampUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={company.stampUrl}
                    alt="Company stamp"
                    className="h-24 w-24 object-contain"
                  />
                )}
              </div>
              <div className="border-t border-gray-400 pt-1 text-[10px] font-bold">
                Authorised Signatory
              </div>
              <div className="text-[9px] text-gray-500">{company.name}</div>
            </div>
          </div>

          {/* Footer */}
          <footer className="border-t border-gray-200 pt-2 text-center">
            <p className="text-[8.5px] text-gray-500">
              This is a computer-generated salary slip, valid with the company seal and authorised
              signature. Confidential — for the named employee only.
            </p>
            {brand.length > 0 && (
              <p className="mt-0.5 text-[9px] font-bold tracking-wide text-brand">
                {brand.join(' · ')}
              </p>
            )}
          </footer>
        </div>
      </article>
    </div>
  );
}
