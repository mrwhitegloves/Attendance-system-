import { Document, Image, StyleSheet, Text, View } from '@react-pdf/renderer';
import { BOLD, COLORS } from './pdfTheme.js';
import { LetterPage } from './LetterPage.jsx';
import { RichText } from './RichText.jsx';

// The offer letter in the founder's format (MWG and EngenX share it; the brand changes the
// header). `content` is the structure edited on the offer letter screen
// (validation: offerContentBody). The same component makes the preview and the PDF file.

const DATE = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
export const longDate = (day) => (day ? DATE.format(new Date(`${day}T00:00:00Z`)) : '');

const s = StyleSheet.create({
  toRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  small: { fontSize: 9, color: COLORS.grey, marginBottom: 2 },
  toName: { fontFamily: BOLD, fontSize: 11.5, marginBottom: 1 },
  toAddress: { fontSize: 10, color: COLORS.grey },
  right: { alignItems: 'flex-end' },
  subject: {
    backgroundColor: COLORS.fill,
    paddingVertical: 6.5,
    paddingHorizontal: 10,
    marginBottom: 11,
  },
  subjectText: { fontFamily: BOLD, fontSize: 10.5 },
  subjectLabel: { color: COLORS.red },
  salutation: { marginBottom: 7 },
  paragraph: { textAlign: 'justify', marginBottom: 6 },
  heading: {
    flexDirection: 'row',
    marginTop: 14,
    marginBottom: 7,
    paddingBottom: 3,
    borderBottomWidth: 0.75,
    borderBottomColor: COLORS.rule,
  },
  headingNumber: { fontFamily: BOLD, fontSize: 10.5, color: COLORS.red, width: 22 },
  headingTitle: { fontFamily: BOLD, fontSize: 10.5 },
  table: { borderTopWidth: 0.5, borderLeftWidth: 0.5, borderColor: COLORS.rule },
  row: { flexDirection: 'row' },
  labelCell: {
    width: 155,
    backgroundColor: COLORS.fill,
    paddingVertical: 4.5,
    paddingLeft: 8,
    paddingRight: 6,
    borderRightWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: COLORS.rule,
    fontFamily: BOLD,
    fontSize: 9.5,
    color: COLORS.grey,
  },
  valueCell: {
    flex: 1,
    paddingVertical: 4.5,
    paddingLeft: 8,
    paddingRight: 6,
    borderRightWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: COLORS.rule,
    fontFamily: BOLD,
    fontSize: 10,
  },
  bullet: { flexDirection: 'row', marginBottom: 4, paddingLeft: 6 },
  // The red square bullet of the format (drawn: the PDF font has no square character).
  bulletBox: { width: 14, paddingTop: 4 },
  bulletMark: { width: 4.5, height: 4.5, backgroundColor: COLORS.red },
  bulletText: { flex: 1 },
  term: { textAlign: 'justify', marginBottom: 5.5 },
  signOff: { marginTop: 6 },
  stamp: { width: 72, height: 72, marginVertical: 2 },
  signName: { fontFamily: BOLD, fontSize: 10.5 },
  signTitle: { fontSize: 9, color: COLORS.grey, marginBottom: 6 },
  acceptText: { textAlign: 'justify', marginBottom: 18 },
  signRow: { flexDirection: 'row', justifyContent: 'space-between' },
  signCell: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.ink,
    height: 22,
    justifyContent: 'flex-end',
  },
  signLabel: { fontSize: 8.5, color: COLORS.grey, marginTop: 3 },
});

function Heading({ number, title }) {
  // Keeps a heading with the first lines under it (never alone at the bottom of a page).
  return (
    <View style={s.heading} minPresenceAhead={40} wrap={false}>
      <Text style={s.headingNumber}>{String(number).padStart(2, '0')}</Text>
      <Text style={s.headingTitle}>{title.toUpperCase()}</Text>
    </View>
  );
}

function Section({ section, number }) {
  return (
    <View>
      <Heading number={number} title={section.title} />
      {section.type === 'table' && (
        <View style={s.table}>
          {section.rows.map((row, index) => (
            <View key={index} style={s.row} wrap={false}>
              <Text style={s.labelCell}>{row.label}</Text>
              <Text style={s.valueCell}>{row.value}</Text>
            </View>
          ))}
        </View>
      )}
      {section.type === 'bullets' &&
        section.items.map((item, index) => (
          <View key={index} style={s.bullet} wrap={false}>
            <View style={s.bulletBox}>
              <View style={s.bulletMark} />
            </View>
            <RichText style={s.bulletText} text={item} />
          </View>
        ))}
      {section.type === 'paragraphs' &&
        section.paragraphs.map((paragraph, index) => (
          <RichText key={index} style={s.paragraph} text={paragraph} />
        ))}
      {section.type === 'terms' &&
        section.items.map((item, index) => (
          <Text key={index} style={s.term}>
            <Text style={{ fontFamily: BOLD }}>{item.title.replace(/\.?$/, '.')} </Text>
            {item.text}
          </Text>
        ))}
    </View>
  );
}

/**
 * @param {{ content: object, company: object, brand: object, logoSrc: any, stampSrc: any,
 *   draft?: boolean }} props
 */
export function OfferLetterDocument({ content, company, brand, logoSrc, stampSrc, draft }) {
  const sections = content.sections ?? [];
  return (
    <Document title={content.subject || 'Offer letter'} author={company.name}>
      <LetterPage company={company} brand={brand} logoSrc={logoSrc} draft={draft}>
        <View style={s.toRow}>
          <View>
            <Text style={s.small}>To,</Text>
            <Text style={s.toName}>{content.toName}</Text>
            {content.toAddress ? <Text style={s.toAddress}>{content.toAddress}</Text> : null}
          </View>
          <View style={s.right}>
            <Text style={s.small}>Date</Text>
            <Text style={s.toName}>{longDate(content.date)}</Text>
          </View>
        </View>

        <View style={s.subject}>
          <Text style={s.subjectText}>
            <Text style={s.subjectLabel}>Subject: </Text>
            {content.subject}
          </Text>
        </View>

        <Text style={s.salutation}>
          Dear <Text style={{ fontFamily: BOLD }}>{content.salutation},</Text>
        </Text>
        <RichText style={s.paragraph} text={content.intro} />

        {sections.map((section, index) => (
          <Section key={index} section={section} number={index + 1} />
        ))}

        <View style={{ marginTop: 3 }}>
          {(content.closing ?? []).map((paragraph, index) => (
            <RichText key={index} style={s.paragraph} text={paragraph} />
          ))}
        </View>

        <View style={s.signOff} wrap={false}>
          <Text style={{ marginBottom: 2 }}>{content.signOff.greeting}</Text>
          <Text style={{ fontFamily: BOLD, marginBottom: 3 }}>{content.signOff.forLine}</Text>
          {content.signOff.showStamp && stampSrc ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={stampSrc} style={s.stamp} />
          ) : (
            <View style={{ height: 30 }} />
          )}
          <Text style={s.signName}>{content.signOff.name}</Text>
          <Text style={s.signTitle}>{content.signOff.title}</Text>
        </View>

        {content.acceptance?.show && (
          <View wrap={false}>
            <Heading number={sections.length + 1} title="Acceptance of offer" />
            <RichText style={s.acceptText} text={content.acceptance.text} />
            <View style={s.signRow}>
              <View style={{ width: 150 }}>
                <View style={s.signCell} />
                <Text style={s.signLabel}>Employee signature</Text>
              </View>
              <View style={{ width: 160 }}>
                <View style={s.signCell}>
                  <Text style={{ fontFamily: BOLD }}>{content.acceptance.name}</Text>
                </View>
                <Text style={s.signLabel}>Name</Text>
              </View>
              <View style={{ width: 136 }}>
                <View style={s.signCell} />
                <Text style={s.signLabel}>Date</Text>
              </View>
            </View>
          </View>
        )}
      </LetterPage>
    </Document>
  );
}
