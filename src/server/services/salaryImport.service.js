import { readSheet } from 'read-excel-file/node';
import { User } from '../models/user.model.js';
import { requirePermission } from '../permissions/can.js';
import { createAppError } from '../lib/errors.js';
import { MAX_FILE_BYTES } from '../lib/files.js';
import { toCsv } from '../lib/csv.js';
import { recordAudit } from './audit.service.js';
import { proposeSalary } from './salary.service.js';

// Current salaries from an Excel sheet (CEO answers, 2026-10-28: fixed CTC, start fresh). Each
// row becomes a normal salary proposal (basic = the monthly salary) that the CEO approves on
// the Salary screen, so the maker-checker rule stays. Nothing is approved here.

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MAX_ROWS = 500;

const normal = (text) =>
  String(text ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, '');
const ID_HEADERS = ['employeeid', 'employeecode', 'id', 'mwgid'];
const AMOUNT_HEADERS = ['monthlysalary', 'monthlyctc', 'salary', 'ctc', 'monthlygross', 'amount'];

/** The sample sheet (CSV, opens in Excel; save it as .xlsx after filling). */
export const sampleSheet = () =>
  toCsv(
    ['Employee ID', 'Monthly salary'],
    [
      ['MWG-001', '27000'],
      ['MWG-002', '18000'],
    ],
  );

/** Reads the uploaded .xlsx: the Employee ID column and the Monthly salary column. */
async function readRows(dataUrl) {
  const [, contentType, data] = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/) || [];
  if (contentType !== XLSX) throw createAppError(400, 'Please choose an Excel file (.xlsx).');
  const bytes = Buffer.from(data || '', 'base64');
  if (!bytes.length) throw createAppError(400, 'The file is empty.');
  if (bytes.length > MAX_FILE_BYTES) throw createAppError(413, 'The file is larger than 3 MB.');
  const rows = await readSheet(bytes).catch(() => {
    throw createAppError(400, 'This file could not be read as an Excel sheet.');
  });
  const header = (rows[0] ?? []).map(normal);
  const idColumn = header.findIndex((cell) => ID_HEADERS.includes(cell));
  const amountColumn = header.findIndex((cell) => AMOUNT_HEADERS.includes(cell));
  if (idColumn < 0 || amountColumn < 0) {
    throw createAppError(
      400,
      'The first row must have the columns "Employee ID" and "Monthly salary".',
    );
  }
  const body = rows.slice(1).filter((row) => row.some((cell) => cell !== null && cell !== ''));
  if (body.length > MAX_ROWS) throw createAppError(400, `At most ${MAX_ROWS} rows at a time.`);
  return body.map((row, index) => ({
    line: index + 2,
    employeeId: String(row[idColumn] ?? '')
      .trim()
      .toUpperCase(),
    amount: row[amountColumn],
  }));
}

/**
 * Proposes the salary of every row. Returns one result per row: proposed, or why not.
 * @returns {Promise<{ proposed: number, results: Array<object> }>}
 */
export async function importSalaries(actor, { file, effectiveFrom, reason }, { ip } = {}) {
  requirePermission(actor, 'salary.manage');
  const rows = await readRows(file);
  const results = [];
  const seen = new Set();
  for (const row of rows) {
    const result = { line: row.line, employeeId: row.employeeId };
    const rupees = Number(String(row.amount ?? '').replace(/[,₹\s]/g, ''));
    if (!row.employeeId) {
      results.push({ ...result, ok: false, message: 'No employee ID' });
      continue;
    }
    if (seen.has(row.employeeId)) {
      results.push({ ...result, ok: false, message: 'Same employee twice in the file' });
      continue;
    }
    seen.add(row.employeeId);
    if (!Number.isFinite(rupees) || rupees <= 0 || rupees > 10_000_000) {
      results.push({ ...result, ok: false, message: 'The monthly salary is not a number above 0' });
      continue;
    }
    const user = await User.findOne({ employeeId: row.employeeId }, '_id name').lean();
    if (!user) {
      results.push({ ...result, ok: false, message: 'No employee with this ID' });
      continue;
    }
    try {
      await proposeSalary(
        actor,
        user._id,
        { effectiveFrom, reason, components: { basic: Math.round(rupees * 100) } },
        { ip },
      );
      results.push({
        ...result,
        name: user.name,
        ok: true,
        message: `Proposed: Rs. ${rupees.toFixed(2)} a month`,
      });
    } catch (error) {
      results.push({ ...result, name: user.name, ok: false, message: error.message });
    }
  }
  const proposed = results.filter((item) => item.ok).length;
  await recordAudit(actor, {
    action: 'salary.imported',
    entity: 'salary',
    summary: `Salary sheet: ${proposed} of ${results.length} rows proposed from ${effectiveFrom}`,
    ip,
  });
  return { proposed, results };
}
