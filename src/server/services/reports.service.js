import { Attendance, PUNCH_IN_STATUSES } from '../models/attendance.model.js';
import { AuditLog } from '../models/system.models.js';
import { Candidate } from '../models/candidate.model.js';
import { Exit } from '../models/exit.model.js';
import { LeaveRequest } from '../models/leaveRequest.model.js';
import { Letter } from '../models/letter.model.js';
import { Payslip } from '../models/payslip.model.js';
import { EmployeeRequest } from '../models/request.model.js';
import { User } from '../models/user.model.js';
import { can, requirePermission } from '../permissions/can.js';
import { createAppError, notFound } from '../lib/errors.js';
import {
  clockToMinutes,
  daysBetween,
  indiaDay,
  textTimeToMinutes,
  indiaMinutes,
} from '../lib/dates.js';
import { toCsv } from '../lib/csv.js';
import { dayCondition, momentCondition, overlapCondition } from '../lib/dateFilter.js';
import { DEDUCTIONS, EARNINGS } from '../../config/payslipFields.js';
import { EXIT_TYPES } from '../../config/exitOptions.js';
import { REQUEST_KINDS } from '../../config/requestKinds.js';
import { recordAudit } from './audit.service.js';
import { salaryInForce } from './salary.service.js';

// Reports for the CEO, HR, Finance and the CA (CEO spec section 12): CSV files that open in
// Excel. Every report needs reports.export AND the full ("all") view of its data; every
// download is in the audit log. Bank account numbers, PAN and Aadhaar are never in a report.

const rupees = (paise) => ((paise ?? 0) / 100).toFixed(2);
const fullView = (permission) => (actor) => {
  const scope = can(actor, permission);
  return scope === 'all' || scope === true;
};
const dayOf = (value) => (value ? indiaDay(new Date(value)) : '');

const recordMinutes = (record) => {
  if (record.at) return indiaMinutes(new Date(record.at));
  const fromText = textTimeToMinutes(record.time);
  if (fromText !== null) return fromText;
  return record.createdAt ? indiaMinutes(new Date(record.createdAt)) : null;
};

export const REPORTS = {
  payroll: {
    title: 'Salary register of a month',
    description: 'Every salary slip of a month: earnings, deductions, net and payment status.',
    dates: 'month',
    allowed: fullView('payslips.view'),
    async build({ month }) {
      if (!month) throw createAppError(400, 'month: choose the month');
      const slips = await Payslip.find({ month }).sort({ 'employee.name': 1 }).lean();
      return {
        header: [
          'Employee ID',
          'Name',
          'Department',
          'Designation',
          ...EARNINGS.map((line) => line.label),
          'Total earnings',
          ...DEDUCTIONS.map((line) => line.label),
          'Total deductions',
          'Net salary',
          'Slip',
          'Payment',
          'Paid on',
        ],
        rows: slips.map((slip) => [
          slip.employee.code || slip.employeeId,
          slip.employee.name,
          slip.employee.department,
          slip.employee.designation,
          ...EARNINGS.map((line) => rupees(slip.earnings?.[line.key])),
          rupees(slip.totals.earnings),
          ...DEDUCTIONS.map((line) => rupees(slip.deductions?.[line.key])),
          rupees(slip.totals.deductions),
          rupees(slip.totals.net),
          slip.status,
          slip.status === 'final' ? (slip.payout?.status ?? 'unpaid') : '',
          slip.payout?.paidOn ?? '',
        ]),
      };
    },
  },

  cost: {
    title: 'Employee cost by department',
    description: 'Active employees and their monthly salary in force today, per department.',
    dates: null,
    allowed: fullView('salary.view'),
    async build() {
      const people = await User.find({ status: 'active' }, '_id department').lean();
      const byDepartment = new Map();
      for (const person of people) {
        const structure = await salaryInForce(person._id);
        const key = person.department || '(no department)';
        const row = byDepartment.get(key) ?? { people: 0, withSalary: 0, monthly: 0 };
        row.people += 1;
        if (structure) {
          row.withSalary += 1;
          row.monthly += structure.totals?.monthlyGross ?? 0;
        }
        byDepartment.set(key, row);
      }
      const rows = [...byDepartment.entries()].sort(([a], [b]) => a.localeCompare(b));
      const total = rows.reduce((sum, [, row]) => sum + row.monthly, 0);
      return {
        header: ['Department', 'Employees', 'With a salary', 'Monthly salary', 'Yearly salary'],
        rows: [
          ...rows.map(([name, row]) => [
            name,
            row.people,
            row.withSalary,
            rupees(row.monthly),
            rupees(row.monthly * 12),
          ]),
          [
            'Total',
            people.length,
            rows.reduce((sum, [, row]) => sum + row.withSalary, 0),
            rupees(total),
            rupees(total * 12),
          ],
        ],
      };
    },
  },

  attendance: {
    title: 'Attendance summary',
    description: 'Per employee in the chosen dates: days present, late, on leave, and overtime.',
    dates: 'range',
    allowed: fullView('attendance.view'),
    async build(query) {
      const days = dayCondition(query) ?? { $lte: indiaDay() };
      const [people, records] = await Promise.all([
        User.find({ status: 'active' }, 'name employeeId department expectedInTime expectedOutTime')
          .sort({ name: 1 })
          .lean(),
        Attendance.find({ date: days }).sort({ createdAt: 1 }).lean(),
      ]);
      const byPerson = Map.groupBy(records, (record) => record.employeeId);
      return {
        header: [
          'Employee ID',
          'Name',
          'Department',
          'Days present',
          'Late days',
          'Leave days',
          'Overtime (hours)',
        ],
        rows: people.map((person) => {
          const own = byPerson.get(person.employeeId) ?? [];
          const byDay = Map.groupBy(own, (record) => record.date);
          let present = 0;
          let late = 0;
          let leave = 0;
          let overtime = 0;
          const expected =
            (clockToMinutes(person.expectedOutTime) ?? 1110) -
            (clockToMinutes(person.expectedInTime) ?? 570);
          for (const dayRecords of byDay.values()) {
            if (dayRecords.some((record) => record.status === 'Leave')) leave += 1;
            const first = dayRecords.find((record) => PUNCH_IN_STATUSES.includes(record.status));
            if (!first) continue;
            present += 1;
            if (first.status === 'Late') late += 1;
            const last = dayRecords.findLast((record) => record.status === 'Checked Out');
            if (last)
              overtime += Math.max(0, recordMinutes(last) - recordMinutes(first) - expected);
          }
          return [
            person.employeeId,
            person.name,
            person.department,
            present,
            late,
            leave,
            (overtime / 60).toFixed(2),
          ];
        }),
      };
    },
  },

  leave: {
    title: 'Leave',
    description: 'Leave requests that touch the chosen dates, with paid or unpaid.',
    dates: 'range',
    allowed: fullView('leave.view'),
    async build(query) {
      const leaves = await LeaveRequest.find(overlapCondition(query, 'startDate', 'endDate'))
        .sort({ startDate: -1 })
        .lean();
      return {
        header: ['Employee ID', 'Name', 'From', 'To', 'Days', 'Reason', 'Status', 'Paid'],
        rows: leaves.map((leave) => [
          leave.employeeId,
          leave.employeeName,
          leave.startDate,
          leave.endDate,
          daysBetween(leave.startDate, leave.endDate).length,
          leave.reason,
          leave.status,
          leave.paid === null || leave.paid === undefined ? '' : leave.paid ? 'Paid' : 'Unpaid',
        ]),
      };
    },
  },

  files: {
    title: 'Employee file completeness',
    description:
      'How complete each employee file is (KYC, bank, documents, salary) and what is missing.',
    dates: null,
    allowed: fullView('users.view'),
    async build() {
      const people = await User.find(
        { status: 'active' },
        'name employeeId department completeness',
      )
        .sort({ 'completeness.percent': 1, name: 1 })
        .lean();
      return {
        header: ['Employee ID', 'Name', 'Department', 'Complete (%)', 'Missing'],
        rows: people.map((person) => [
          person.employeeId,
          person.name,
          person.department,
          person.completeness?.percent ?? 0,
          (person.completeness?.missing ?? []).join('; '),
        ]),
      };
    },
  },

  hiring: {
    title: 'Hiring',
    description: 'Candidates added in the chosen dates: offer status and joining.',
    dates: 'range',
    allowed: (actor) => Boolean(can(actor, 'recruitment.view')),
    async build(query) {
      const added = momentCondition(query);
      const candidates = await Candidate.find(added ? { createdAt: added } : {})
        .sort({ createdAt: -1 })
        .lean();
      const offers = await Letter.aggregate([
        {
          $match: {
            candidateId: { $in: candidates.map((candidate) => candidate._id) },
            kind: 'offer',
          },
        },
        { $sort: { version: -1 } },
        { $group: { _id: '$candidateId', status: { $first: '$status' } } },
      ]);
      const offerOf = new Map(offers.map((offer) => [String(offer._id), offer.status]));
      return {
        header: [
          'Name',
          'Designation',
          'Department',
          'Added on',
          'Offer letter',
          'Status',
          'Joined on',
        ],
        rows: candidates.map((candidate) => [
          candidate.name,
          candidate.designation,
          candidate.department,
          dayOf(candidate.createdAt),
          offerOf.get(String(candidate._id)) ?? 'not started',
          candidate.status,
          dayOf(candidate.joinedAt),
        ]),
      };
    },
  },

  exits: {
    title: 'Exits and attrition',
    description: 'Exits with a last working day in the chosen dates, with the full and final.',
    dates: 'range',
    allowed: fullView('exits.view'),
    async build(query) {
      const lastDays = dayCondition(query);
      const exits = await Exit.find(lastDays ? { lastWorkingDay: lastDays } : {})
        .sort({ lastWorkingDay: -1 })
        .lean();
      return {
        header: [
          'Employee ID',
          'Name',
          'Kind',
          'Notice given',
          'Last working day',
          'Status',
          'Full and final',
          'Net (paid +, recovered -)',
          'Reason',
        ],
        rows: exits.map((exit) => [
          exit.employeeId,
          exit.employeeName,
          EXIT_TYPES[exit.type],
          exit.noticeDate,
          exit.lastWorkingDay,
          exit.status,
          exit.settlement?.status ?? 'not prepared',
          exit.settlement ? rupees(exit.settlement.totals.net) : '',
          exit.reason,
        ]),
      };
    },
  },

  expenses: {
    title: 'Expense claims and advances',
    description:
      'Money requests sent in the chosen dates: asked, approved, and the slip that paid it.',
    dates: 'range',
    allowed: fullView('requests.view'),
    async build(query) {
      const sent = momentCondition(query);
      const requests = await EmployeeRequest.find({
        kind: { $in: ['expense', 'advance'] },
        ...(sent ? { createdAt: sent } : {}),
      })
        .sort({ createdAt: -1 })
        .lean();
      const slips = await Payslip.find(
        { _id: { $in: requests.map((request) => request.payslipId).filter(Boolean) } },
        'month',
      ).lean();
      const monthOf = new Map(slips.map((slip) => [String(slip._id), slip.month]));
      return {
        header: [
          'Number',
          'Employee ID',
          'Name',
          'Kind',
          'Subject',
          'Sent on',
          'Asked',
          'Approved',
          'Status',
          'Decided by',
          'Paid with salary of',
        ],
        rows: requests.map((request) => [
          request.number,
          request.employeeId,
          request.employeeName,
          REQUEST_KINDS[request.kind].label,
          request.subject,
          dayOf(request.createdAt),
          rupees(request.amountPaise),
          request.approvedAmountPaise === null ? '' : rupees(request.approvedAmountPaise),
          request.status,
          request.decidedByName,
          request.payslipId ? (monthOf.get(String(request.payslipId)) ?? '') : '',
        ]),
      };
    },
  },

  audit: {
    title: 'Audit log',
    description: 'Who did what in the chosen dates.',
    dates: 'range',
    allowed: (actor) => Boolean(can(actor, 'audit.view')),
    async build(query) {
      const when = momentCondition(query);
      const rows = await AuditLog.find(when ? { createdAt: when } : {})
        .sort({ createdAt: -1 })
        .limit(20000)
        .lean();
      return {
        header: ['When', 'Who', 'Action', 'What'],
        rows: rows.map((row) => [
          new Date(row.createdAt).toISOString(),
          row.actorName,
          row.action,
          row.summary,
        ]),
      };
    },
  },
};

/** The reports this person may download (for the Reports screen). */
export function reportsFor(actor) {
  if (!can(actor, 'reports.export')) return [];
  return Object.entries(REPORTS)
    .filter(([, report]) => report.allowed(actor))
    .map(([key, report]) => ({
      key,
      title: report.title,
      description: report.description,
      dates: report.dates,
    }));
}

/** One report as a CSV file. */
export async function buildReport(actor, key, query, { ip } = {}) {
  requirePermission(actor, 'reports.export');
  const report = REPORTS[key];
  if (!report) throw notFound('Report');
  if (!report.allowed(actor)) throw createAppError(403, 'You do not have access to this.');
  const { header, rows } = await report.build(query);
  await recordAudit(actor, {
    action: 'report.exported',
    entity: 'report',
    summary: `${report.title} exported (${rows.length} rows)${query.month ? `, ${query.month}` : ''}`,
    ip,
  });
  const stamp = query.month || indiaDay();
  return { fileName: `${key}-${stamp}.csv`, text: toCsv(header, rows) };
}
