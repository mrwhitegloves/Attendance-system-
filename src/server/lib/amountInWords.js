// 2700000 paise → "Rupees Twenty-Seven Thousand Only" (Indian numbering: lakh, crore).

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function belowHundred(number) {
  if (number < 20) return ONES[number];
  const tens = TENS[Math.floor(number / 10)];
  return number % 10 ? `${tens}-${ONES[number % 10]}` : tens;
}

function belowThousand(number) {
  const hundreds = Math.floor(number / 100);
  const rest = number % 100;
  return [hundreds ? `${ONES[hundreds]} Hundred` : '', rest ? belowHundred(rest) : '']
    .filter(Boolean)
    .join(' ');
}

/** Whole number → words, e.g. 1234567 → "Twelve Lakh Thirty-Four Thousand Five Hundred Sixty-Seven". */
export function numberInWords(number) {
  if (number === 0) return 'Zero';
  const parts = [];
  const crore = Math.floor(number / 10000000);
  const lakh = Math.floor((number % 10000000) / 100000);
  const thousand = Math.floor((number % 100000) / 1000);
  const rest = number % 1000;
  if (crore) parts.push(`${numberInWords(crore)} Crore`);
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  if (rest) parts.push(belowThousand(rest));
  return parts.join(' ');
}

/** Paise → "Rupees … [and … Paise] Only". Negative amounts start with "Minus". */
export function amountInWords(paise) {
  const sign = paise < 0 ? 'Minus ' : '';
  const absolute = Math.abs(Math.round(paise));
  const rupees = Math.floor(absolute / 100);
  const rest = absolute % 100;
  return `${sign}Rupees ${numberInWords(rupees)}${rest ? ` and ${belowHundred(rest)} Paise` : ''} Only`;
}
