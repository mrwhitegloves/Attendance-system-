import { Document, StyleSheet, Text, View } from '@react-pdf/renderer';
import { BOLD, COLORS } from '../../letters/pdf/pdfTheme.js';
import { LetterPage } from '../../letters/pdf/LetterPage.jsx';
import { longDate } from '../../letters/pdf/OfferLetterDocument.jsx';

// The full-and-final statement of an employee who leaves, on the company letter pages.

const AMOUNT = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const rs = (paise) => `Rs. ${AMOUNT.format((paise ?? 0) / 100)}`;

const s = StyleSheet.create({
  title: { fontFamily: BOLD, fontSize: 13, textAlign: 'center', marginBottom: 12 },
  facts: { borderTopWidth: 0.5, borderLeftWidth: 0.5, borderColor: COLORS.rule, marginBottom: 14 },
  factRow: { flexDirection: 'row' },
  factLabel: {
    width: 150,
    backgroundColor: COLORS.fill,
    padding: 5,
    borderRightWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: COLORS.rule,
    fontFamily: BOLD,
    fontSize: 9,
    color: COLORS.grey,
  },
  factValue: {
    flex: 1,
    padding: 5,
    borderRightWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: COLORS.rule,
  },
  head: {
    flexDirection: 'row',
    backgroundColor: COLORS.ink,
    color: '#FFFFFF',
    fontFamily: BOLD,
    fontSize: 9,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  line: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderColor: COLORS.rule,
  },
  colLabel: { flex: 1 },
  colAmount: { width: 110, textAlign: 'right' },
  note: { fontSize: 8, color: COLORS.grey },
  total: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 6, fontFamily: BOLD },
  net: {
    marginTop: 10,
    backgroundColor: COLORS.fill,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.red,
    padding: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontFamily: BOLD,
    fontSize: 11,
  },
  small: { fontSize: 8.5, color: COLORS.grey, marginTop: 8 },
  signRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 50 },
  signLine: {
    width: 170,
    borderTopWidth: 1,
    borderColor: COLORS.ink,
    paddingTop: 3,
    fontSize: 8.5,
    color: COLORS.grey,
  },
});

function Lines({ title, lines }) {
  if (!lines.length) return null;
  return (
    <View style={{ marginBottom: 10 }} wrap={false}>
      <View style={s.head}>
        <Text style={s.colLabel}>{title}</Text>
        <Text style={s.colAmount}>Amount</Text>
      </View>
      {lines.map((line, index) => (
        <View key={index} style={s.line}>
          <View style={s.colLabel}>
            <Text>{line.label}</Text>
            {line.note ? <Text style={s.note}>{line.note}</Text> : null}
          </View>
          <Text style={s.colAmount}>{rs(line.amountPaise)}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * @param {{ person: object, exit: object, company: object, brand: object, logoSrc: any }} props
 */
export function SettlementDocument({ person, exit, company, brand, logoSrc }) {
  const settlement = exit.settlement;
  const facts = [
    ['Employee', `${person.name} (${person.employeeCode || person.employeeId})`],
    ['Designation', person.designation || '—'],
    ['Date of joining', longDate(person.joiningDate) || '—'],
    ['Notice given on', longDate(exit.noticeDate)],
    ['Last working day', longDate(exit.lastWorkingDay)],
  ];
  const net = settlement.totals.net;
  return (
    <Document title={`Full and final ${person.name}`} author={company.name}>
      <LetterPage
        company={company}
        brand={brand}
        logoSrc={logoSrc}
        draft={settlement.status === 'draft'}
      >
        <Text style={s.title}>FULL AND FINAL SETTLEMENT</Text>
        <View style={s.facts}>
          {facts.map(([label, value]) => (
            <View key={label} style={s.factRow}>
              <Text style={s.factLabel}>{label}</Text>
              <Text style={s.factValue}>{value}</Text>
            </View>
          ))}
        </View>
        <Lines
          title="Paid to the employee"
          lines={settlement.lines.filter((line) => line.kind === 'add')}
        />
        <Lines
          title="Taken back"
          lines={settlement.lines.filter((line) => line.kind === 'deduct')}
        />
        <View style={s.net}>
          <Text>{net >= 0 ? 'Net payable to the employee' : 'Net payable by the employee'}</Text>
          <Text>{rs(Math.abs(net))}</Text>
        </View>
        <Text style={s.small}>
          The salary of the last month is paid on its own salary slip.
          {settlement.status === 'paid' && settlement.paidOn
            ? ` Settled on ${longDate(settlement.paidOn)}${settlement.reference ? `, reference ${settlement.reference}` : ''}.`
            : ''}
          {settlement.approvedByName ? ` Approved by ${settlement.approvedByName}.` : ''}
        </Text>
        <View style={s.signRow} wrap={false}>
          <Text style={s.signLine}>Employee signature</Text>
          <Text style={s.signLine}>For {company.shortName || company.name}</Text>
        </View>
      </LetterPage>
    </Document>
  );
}
