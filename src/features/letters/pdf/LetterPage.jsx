import { Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { BOLD, COLORS, FONT, LINE_HEIGHT, PAGE } from './pdfTheme.js';

// One letter page: the header and footer of the founder's format sit at the same place on every
// page (fixed), and the body flows from page to page between them without being cut.

const styles = StyleSheet.create({
  page: {
    fontFamily: FONT,
    fontSize: 10,
    lineHeight: LINE_HEIGHT,
    color: COLORS.ink,
    paddingTop: PAGE.paddingTop,
    paddingBottom: PAGE.paddingBottom,
    paddingHorizontal: PAGE.paddingHorizontal,
  },
  header: {
    position: 'absolute',
    top: PAGE.headerTop,
    left: PAGE.paddingHorizontal,
    right: PAGE.paddingHorizontal,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerText: { alignItems: 'flex-end', lineHeight: 1.2 },
  company: { fontFamily: BOLD, fontSize: 10.5, color: COLORS.ink, marginBottom: 1 },
  brandLine: { fontSize: 8.5, color: COLORS.grey },
  brandName: { fontFamily: BOLD, color: COLORS.red },
  headerRule: { marginTop: 6, borderBottomWidth: 0.75, borderBottomColor: COLORS.red },
  footer: {
    position: 'absolute',
    // Placed from the top: react-pdf measures "bottom" of a fixed element unreliably.
    top: PAGE.height - PAGE.footerBottom - PAGE.footerHeight,
    left: PAGE.paddingHorizontal,
    right: PAGE.paddingHorizontal,
    borderTopWidth: 0.75,
    borderTopColor: COLORS.red,
    paddingTop: 4,
    fontSize: 7.5,
    color: COLORS.grey,
    textAlign: 'center',
    lineHeight: 1.3,
  },
  footerCompany: { fontFamily: BOLD, color: COLORS.ink },
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

const join = (...parts) => parts.filter(Boolean).join('  ·  ');

/**
 * @param {{ company: object, brand: object, logoSrc: any, draft?: boolean, children: any }} props
 * brand: { name, website, email, logoWidth, logoHeight } (settings.service brandFor)
 */
export function LetterPage({ company, brand, logoSrc, draft = false, children }) {
  const legalName = company.name || 'White Gloves Technology Private Limited';
  return (
    <Page size={PAGE.size} style={styles.page} wrap>
      {draft && (
        <Text style={styles.draft} fixed>
          DRAFT
        </Text>
      )}
      <View style={styles.header} fixed>
        <View style={styles.headerRow}>
          {logoSrc ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={logoSrc} style={{ width: brand.logoWidth, height: brand.logoHeight }} />
          ) : (
            <View />
          )}
          <View style={styles.headerText}>
            <Text style={styles.company}>{legalName.toUpperCase()}</Text>
            <Text style={styles.brandLine}>
              <Text style={styles.brandName}>{brand.name}</Text>
              {brand.website ? `  ·  ${brand.website}` : ''}
            </Text>
          </View>
        </View>
        <View style={styles.headerRule} />
      </View>

      <View style={styles.footer} fixed>
        <Text>
          <Text style={styles.footerCompany}>{legalName}</Text>
          {company.address ? `  ·  ${company.address.replace(/\s*\n\s*/g, ', ')}` : ''}
        </Text>
        <Text>{join(company.cin && `CIN ${company.cin}`, brand.website, brand.email)}</Text>
        <Text
          fixed
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
        />
      </View>

      {children}
    </Page>
  );
}
