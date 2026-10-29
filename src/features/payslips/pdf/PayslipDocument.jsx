import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { ATTENDANCE_SUMMARY, DEDUCTIONS, EARNINGS } from '../../../config/payslipFields.js';
import { BOLD, FONT } from '../../letters/pdf/pdfTheme.js';

// The salary slip on one A4 page as a PDF: the approved slip design (black header, red accent),
// with the logo of the employee's brand (Mr. White Gloves or EngenX). Amounts in rupees with
// "Rs." (the PDF font has no rupee sign).

const RED = '#D80109';
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

const s = StyleSheet.create({
  page: { fontFamily: FONT, fontSize: 9, color: '#111111', padding: 22 },
  header: {
    backgroundColor: '#000000',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  logoTile: { backgroundColor: '#FFFFFF', borderRadius: 4, padding: 5, marginRight: 10 },
  brandName: { fontFamily: BOLD, fontSize: 15, color: '#FFFFFF', letterSpacing: 0.5 },
  tagline: { fontFamily: BOLD, fontSize: 7.5, color: RED, letterSpacing: 1, marginTop: 2 },
  slipTitle: {
    fontFamily: BOLD,
    fontSize: 21,
    color: '#FFFFFF',
    textAlign: 'right',
    letterSpacing: 0.5,
  },
  slipMonth: { fontFamily: BOLD, fontSize: 9, color: RED, textAlign: 'right', marginTop: 2 },
  accent: { height: 3, backgroundColor: RED, marginBottom: 12 },
  body: { paddingHorizontal: 6 },
  companyRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  companyName: { fontFamily: BOLD, fontSize: 11 },
  muted: { fontSize: 7.5, color: '#6B7280', marginTop: 1 },
  details: {
    backgroundColor: '#F9FAFB',
    borderWidth: 0.75,
    borderColor: '#E5E7EB',
    borderLeftWidth: 3,
    borderLeftColor: RED,
    borderRadius: 3,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  sectionLabel: {
    fontFamily: BOLD,
    fontSize: 7.5,
    color: RED,
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  detailRow: { flexDirection: 'row', marginBottom: 3.5 },
  detailCell: { flexDirection: 'row', width: '50%' },
  detailLabel: { width: 88, color: '#6B7280', fontSize: 8.5 },
  detailValue: { fontFamily: BOLD, fontSize: 8.5, flex: 1 },
  tiles: { flexDirection: 'row', marginBottom: 10 },
  tile: {
    flex: 1,
    borderWidth: 0.75,
    borderColor: '#E5E7EB',
    borderRadius: 3,
    paddingVertical: 6,
    alignItems: 'center',
  },
  tileValue: { fontFamily: BOLD, fontSize: 14 },
  tileLabel: { fontSize: 6.5, color: '#6B7280', marginTop: 2, textAlign: 'center' },
  tables: { flexDirection: 'row', marginBottom: 10 },
  table: { flex: 1, borderWidth: 0.75, borderColor: '#E5E7EB', borderRadius: 3 },
  tableHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    paddingHorizontal: 8,
    fontFamily: BOLD,
    fontSize: 7.5,
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: 15.5,
    alignItems: 'center',
    paddingHorizontal: 8,
    fontSize: 8,
  },
  total: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.75,
    borderTopColor: '#D1D5DB',
    paddingVertical: 5,
    paddingHorizontal: 8,
    fontFamily: BOLD,
    fontSize: 8.5,
  },
  net: {
    backgroundColor: '#000000',
    borderLeftWidth: 3,
    borderLeftColor: RED,
    borderRadius: 3,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  netLabel: { fontFamily: BOLD, fontSize: 7.5, color: '#D1D5DB', letterSpacing: 0.8 },
  netWords: { fontSize: 8, color: '#E5E7EB', marginTop: 2, maxWidth: 330 },
  netAmount: { fontFamily: BOLD, fontSize: 20, color: '#FFFFFF' },
  signRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'flex-end' },
  signLine: {
    borderTopWidth: 0.75,
    borderTopColor: '#9CA3AF',
    paddingTop: 3,
    fontFamily: BOLD,
    fontSize: 8,
  },
  stamp: { width: 70, height: 70, marginBottom: 2 },
  footer: {
    borderTopWidth: 0.75,
    borderTopColor: '#E5E7EB',
    marginTop: 12,
    paddingTop: 5,
    textAlign: 'center',
    fontSize: 7,
    color: '#6B7280',
  },
  footerBrand: { fontFamily: BOLD, fontSize: 7.5, color: RED, marginTop: 2, letterSpacing: 0.5 },
  draft: {
    position: 'absolute',
    top: 330,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: BOLD,
    fontSize: 96,
    color: '#EEEEEE',
    transform: 'rotate(-30deg)',
  },
});

function MoneyTable({ title, rows, total, color, count }) {
  return (
    <View style={s.table}>
      <View style={[s.tableHead, { backgroundColor: color }]}>
        <Text>{title.toUpperCase()}</Text>
        <Text>AMOUNT (RS.)</Text>
      </View>
      {Array.from({ length: count }, (_, index) => rows[index] ?? null).map((row, index) => (
        <View key={index} style={[s.line, { backgroundColor: index % 2 ? '#F9FAFB' : '#FFFFFF' }]}>
          <Text>{row?.label ?? ''}</Text>
          <Text>{row ? (row.value ? amount(row.value) : '–') : ''}</Text>
        </View>
      ))}
      <View style={s.total}>
        <Text>Total {title}</Text>
        <Text>{amount(total)}</Text>
      </View>
    </View>
  );
}

/**
 * @param {{ slip: object, company: object, brand: object, logoSrc: any, stampSrc: any }} props
 */
export function PayslipDocument({ slip, company, brand, logoSrc, stampSrc }) {
  const lines = (list, values) =>
    list.map((line) => ({ label: line.label, value: values?.[line.key] ?? 0 }));
  const earnings = lines(EARNINGS, slip.earnings);
  const deductions = lines(DEDUCTIONS, slip.deductions);
  const count = Math.max(earnings.length, deductions.length);
  const employee = slip.employee;
  const details = [
    ['Employee Name', employee.name, 'PAN', employee.pan || '—'],
    ['Employee Code', employee.code, 'Bank Name', employee.bankName || '—'],
    ['Designation', employee.designation || '—', 'Bank Account No.', employee.account || '—'],
    ['Date of Joining', longDay(employee.joiningDate), 'Pay Period', monthName(slip.month)],
  ];
  const footerBrand = [brand.name, brand.tagline].filter(Boolean).join('  ·  ');

  return (
    <Document title={`Salary slip ${slip.month} ${employee.name}`} author={company.name}>
      <Page size="A4" style={s.page}>
        {slip.status === 'draft' && (
          <Text style={s.draft} fixed>
            DRAFT
          </Text>
        )}
        <View style={s.header}>
          <View style={s.brandRow}>
            {logoSrc && (
              <View style={s.logoTile}>
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image
                  src={logoSrc}
                  style={{ width: brand.logoWidth * 0.75, height: brand.logoHeight * 0.75 }}
                />
              </View>
            )}
            <View>
              <Text style={s.brandName}>{(brand.name || company.name).toUpperCase()}</Text>
              {brand.tagline ? <Text style={s.tagline}>{brand.tagline}</Text> : null}
            </View>
          </View>
          <View>
            <Text style={s.slipTitle}>SALARY SLIP</Text>
            <Text style={s.slipMonth}>FOR THE MONTH OF {monthName(slip.month).toUpperCase()}</Text>
          </View>
        </View>
        <View style={s.accent} />

        <View style={s.body}>
          <View style={s.companyRow}>
            <View>
              <Text style={s.companyName}>{company.name}</Text>
              {company.address ? <Text style={s.muted}>{company.address}</Text> : null}
              {company.gstNumber ? (
                <Text style={s.muted}>GST Registration No: {company.gstNumber}</Text>
              ) : null}
            </View>
            {brand.website ? <Text style={s.muted}>{brand.website}</Text> : null}
          </View>

          <View style={s.details}>
            <Text style={s.sectionLabel}>EMPLOYEE DETAILS</Text>
            {details.map(([leftLabel, leftValue, rightLabel, rightValue]) => (
              <View key={leftLabel} style={s.detailRow}>
                <View style={s.detailCell}>
                  <Text style={s.detailLabel}>{leftLabel}</Text>
                  <Text style={s.detailValue}>{leftValue}</Text>
                </View>
                <View style={s.detailCell}>
                  <Text style={s.detailLabel}>{rightLabel}</Text>
                  <Text style={s.detailValue}>{rightValue}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={s.tiles}>
            {ATTENDANCE_SUMMARY.map((line, index) => (
              <View key={line.key} style={[s.tile, index > 0 ? { marginLeft: 6 } : {}]}>
                <Text style={s.tileValue}>{slip.attendance?.[line.key] ?? 0}</Text>
                <Text style={s.tileLabel}>{line.label.toUpperCase()}</Text>
              </View>
            ))}
          </View>

          <View style={s.tables}>
            <MoneyTable
              title="Earnings"
              rows={earnings}
              total={slip.totals.earnings}
              color="#000000"
              count={count}
            />
            <View style={{ width: 10 }} />
            <MoneyTable
              title="Deductions"
              rows={deductions}
              total={slip.totals.deductions}
              color={RED}
              count={count}
            />
          </View>

          <View style={s.net}>
            <View>
              <Text style={s.netLabel}>NET SALARY PAYABLE</Text>
              <Text style={s.netWords}>{slip.netInWords}</Text>
            </View>
            <Text style={s.netAmount}>Rs. {amount(slip.totals.net)}</Text>
          </View>

          {/* Only the company signs a salary slip (founder, 2026-10-29: no employee signature). */}
          <View style={s.signRow}>
            <View style={{ width: 190 }}>
              {stampSrc ? (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image src={stampSrc} style={s.stamp} />
              ) : (
                <View style={{ height: 72 }} />
              )}
              <Text style={s.signLine}>Authorised Signatory</Text>
              <Text style={[s.muted, { fontSize: 7 }]}>{company.name}</Text>
            </View>
          </View>

          <View style={s.footer}>
            <Text>
              This is a computer-generated salary slip, valid with the company seal and authorised
              signature. Confidential — for the named employee only.
            </Text>
            {footerBrand ? <Text style={s.footerBrand}>{footerBrand}</Text> : null}
          </View>
        </View>
      </Page>
    </Document>
  );
}
