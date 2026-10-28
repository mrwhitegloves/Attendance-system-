// CSV files (open in Excel). A cell that starts with = + - @ is prefixed with ' so Excel never
// runs it as a formula. A BOM makes Excel read the file as UTF-8.

const cell = (value) => {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** @param {string[]} header @param {Array<Array<any>>} rows */
export function toCsv(header, rows) {
  return `﻿${[header, ...rows].map((row) => row.map(cell).join(',')).join('\r\n')}\r\n`;
}

/** A CSV file as an HTTP answer (always downloaded). */
export function csvResponse(fileName, text) {
  return new Response(text, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
