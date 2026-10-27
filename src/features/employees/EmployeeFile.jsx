import Link from 'next/link';
import { CheckCircle2, CircleAlert } from 'lucide-react';
import { Card, CardHeader } from '@/components/shared/ui.jsx';
import { CompletenessBar } from '@/components/shared/Avatar.jsx';
import { formatDateTime, formatDay } from '@/lib/format.js';
import { EMPLOYMENT_STATUS, EMPLOYMENT_TYPE, GENDER, WORK_MODE } from '@/config/employeeOptions.js';

const orDash = (value) => (value ? value : '—');

/** One employee's file: how complete it is, then every section. Used on the profile and /me. */
export function EmployeeFile({ employee, managerName, roleName, checklist, canEdit, editHref }) {
  const href = editHref ?? `/employees/${employee._id}/edit`;
  const contact = employee.emergencyContact ?? {};
  const sections = [
    {
      title: 'Personal',
      rows: [
        ['Full name', employee.name],
        ['Mobile', orDash(employee.phone)],
        ['Date of birth', employee.dateOfBirth ? formatDay(employee.dateOfBirth) : '—'],
        ['Gender', GENDER.label(employee.gender)],
        ['Blood group', orDash(employee.bloodGroup)],
        ['Personal email', orDash(employee.personalEmail)],
        ['Current address', orDash(employee.currentAddress)],
        ['Permanent address', orDash(employee.permanentAddress)],
      ],
    },
    {
      title: 'Emergency contact',
      rows: [
        ['Name', orDash(contact.name)],
        ['Relation', orDash(contact.relation)],
        ['Phone', orDash(contact.phone)],
      ],
    },
    {
      title: 'Employment',
      rows: [
        ['Employee ID', employee.employeeId],
        ['Employee code', orDash(employee.employeeCode)],
        ['Designation', orDash(employee.designation)],
        ['Department', orDash(employee.department)],
        ['Branch', orDash(employee.branch)],
        ['Reporting manager', orDash(managerName)],
        ['Employment type', EMPLOYMENT_TYPE.label(employee.employmentType)],
        ['Work mode', WORK_MODE.label(employee.workMode)],
        ['Employment status', EMPLOYMENT_STATUS.label(employee.employmentStatus)],
        ['Staff type', employee.staffType],
        ['Joining date', employee.joiningDate ? formatDay(employee.joiningDate) : '—'],
        ['Probation ends', employee.probationEndDate ? formatDay(employee.probationEndDate) : '—'],
      ],
    },
    {
      title: 'Work timing and access',
      rows: [
        ['Shift', `${employee.expectedInTime} – ${employee.expectedOutTime}`],
        ['Work email (sign-in)', orDash(employee.email)],
        ['Role', roleName],
        ['Added on', formatDateTime(employee.createdAt)],
        ['Last sign-in', formatDateTime(employee.lastLoginAt)],
      ],
    },
  ];
  const missing = checklist.filter((item) => !item.done);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <div className="space-y-4">
        {sections.map((section) => (
          <Card key={section.title}>
            <CardHeader title={section.title} />
            <dl className="grid sm:grid-cols-2">
              {section.rows.map(([label, value]) => (
                <div
                  key={label}
                  className="flex justify-between gap-3 border-b border-border px-4 py-2.5 text-sm"
                >
                  <dt className="text-muted">{label}</dt>
                  <dd className="text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        ))}
      </div>
      <Card className="h-fit lg:sticky lg:top-6">
        <CardHeader title="File completeness" subtitle="Worked out from the record itself." />
        <div className="space-y-3 p-4">
          <CompletenessBar percent={employee.completeness?.percent ?? 0} />
          {missing.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 size={16} /> Everything is filled in.
            </p>
          ) : (
            <>
              <p className="text-xs font-medium text-muted">Missing ({missing.length})</p>
              <ul className="space-y-1.5 text-sm">
                {missing.map((item) => (
                  <li key={item.label} className="flex items-center gap-2">
                    <CircleAlert size={14} className="shrink-0 text-warning" /> {item.label}
                  </li>
                ))}
              </ul>
              {canEdit && (
                <Link href={href} className="inline-block text-sm text-brand underline">
                  Fill in the missing details
                </Link>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
