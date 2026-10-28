import { Font } from '@react-pdf/renderer';

// Words are never split with a hyphen at the end of a line (Word does not do it either).
Font.registerHyphenationCallback((word) => [word]);

// Measurements and colours of the founder's offer letter format (.docx), in PDF points
// (1 pt = 20 twips). One place, used by every letter PDF.

export const COLORS = {
  red: '#D80109',
  ink: '#1A1A1A',
  grey: '#5F6368',
  rule: '#DDDDE0',
  fill: '#F4F4F5',
};

// A4 with the margins of the .docx: top 1800, sides 1134, bottom 1500 twips; header 560 and
// footer 480 twips from the edge.
export const PAGE = {
  size: 'A4',
  paddingTop: 90,
  paddingBottom: 75,
  paddingHorizontal: 56.7,
  headerTop: 28,
  footerBottom: 24,
  // A4 is 841.89 pt high; the footer (three small lines) is at most 38 pt high.
  height: 841.89,
  footerHeight: 38,
};

// Helvetica is the PDF twin of Arial (same widths), built into every PDF reader.
export const FONT = 'Helvetica';
export const BOLD = 'Helvetica-Bold';

// Word's 1.15 line spacing for Arial.
export const LINE_HEIGHT = 1.35;
