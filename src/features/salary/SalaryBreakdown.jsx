import { COMPONENT_GROUPS, SALARY_COMPONENTS } from '@/config/salaryComponents.js';
import { formatRupees } from '@/lib/format.js';

/** A salary structure as a table: groups of components, then the totals. */
export function SalaryBreakdown({ structure }) {
  const { components, totals } = structure;
  return (
    <div className="space-y-3 text-sm">
      {COMPONENT_GROUPS.map((group) => {
        const rows = SALARY_COMPONENTS.filter(
          (item) => item.kind === group.kind && components[item.key] > 0,
        );
        if (!rows.length) return null;
        return (
          <div key={group.kind}>
            <p className="mb-1 text-xs font-medium text-muted">{group.label}</p>
            <dl className="space-y-1">
              {rows.map((item) => (
                <div key={item.key} className="flex justify-between gap-3">
                  <dt>{item.label}</dt>
                  <dd className="tabular-nums">{formatRupees(components[item.key])}</dd>
                </div>
              ))}
            </dl>
          </div>
        );
      })}
      <dl className="space-y-1 border-t border-border pt-2">
        {[
          ['Monthly gross', totals.monthlyGross],
          ['Monthly take-home (estimate)', totals.monthlyNet],
          ['Monthly cost to company', totals.monthlyCtc],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="text-muted">{label}</dt>
            <dd className="tabular-nums">{formatRupees(value)}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-3 text-base font-semibold">
          <dt>Annual CTC</dt>
          <dd className="tabular-nums">{formatRupees(totals.annualCtc)}</dd>
        </div>
      </dl>
    </div>
  );
}
