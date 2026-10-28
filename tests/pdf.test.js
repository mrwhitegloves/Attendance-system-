import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToBuffer } from '@react-pdf/renderer';
import { OfferLetterDocument } from '@/features/letters/pdf/OfferLetterDocument.jsx';
import { PayslipDocument } from '@/features/payslips/pdf/PayslipDocument.jsx';
import { defaultOfferContent } from '@/server/lib/offerLetter.js';
import { BRANDS } from '@/config/brands.js';
import { brandLogo } from '@/server/services/pdf.service.js';

// Renders the real PDF files. With PDF_OUT=<folder> they are also written there to look at.

const COMPANY = {
  name: 'White Gloves Technology Private Limited',
  shortName: 'White Gloves Technology Pvt. Ltd.',
  cin: 'U50400JH2021PTC017561',
  address: '102, Asha Krishna Kunj, Road No. 6, Adityapur, Saraikela Kharsawan, Jharkhand 831013',
  gstNumber: '20AADCW1091R1Z3',
};
const brand = (key) => ({ key, ...BRANDS[key], ...BRANDS[key].defaults });
const pageCount = (buffer) =>
  (buffer.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
const save = (name, buffer) =>
  process.env.PDF_OUT ? writeFile(path.join(process.env.PDF_OUT, name), buffer) : null;

describe('PDF files', () => {
  it.each(['mwg', 'engenx'])('makes the %s offer letter on several A4 pages', async (key) => {
    const content = defaultOfferContent({
      person: {
        name: 'Vivek Rajak',
        address: 'Jamshedpur, Jharkhand',
        designation: 'Business Development Associate (Franchise Sales)',
        expectedJoiningDate: '2026-10-28',
        workMode: 'office',
      },
      company: { ...COMPANY, signatoryName: 'Muskan', signatoryTitle: '' },
      managerName: 'Mr. Kunal Divyanshu',
      today: '2026-10-26',
    });
    const buffer = await renderToBuffer(
      createElement(OfferLetterDocument, {
        content,
        company: COMPANY,
        brand: brand(key),
        logoSrc: await brandLogo(brand(key)),
        stampSrc: null,
      }),
    );
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(pageCount(buffer)).toBeGreaterThanOrEqual(2);
    await save(`offer-${key}.pdf`, buffer);
  });

  it('makes the salary slip on one page', async () => {
    const slip = {
      month: '2026-09',
      status: 'final',
      employee: {
        name: 'Sunil Field',
        code: 'MWG-004',
        designation: 'Field Executive',
        joiningDate: '2026-01-05',
        bankName: 'State Bank of India',
        pan: '******234F',
        account: 'XXXXXX6789',
      },
      attendance: {
        totalWorkingDays: 26,
        fullDays: 18,
        halfDays: 5,
        leavesTaken: 1,
        balanceLeaves: 0,
      },
      earnings: { basic: 2700000 },
      deductions: { lossOfPay: 360000 },
      totals: { earnings: 2700000, deductions: 360000, net: 2340000 },
      netInWords: 'Rupees Twenty-Three Thousand Four Hundred Only',
    };
    const buffer = await renderToBuffer(
      createElement(PayslipDocument, {
        slip,
        company: COMPANY,
        brand: brand('engenx'),
        logoSrc: await brandLogo(brand('engenx')),
        stampSrc: null,
      }),
    );
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(pageCount(buffer)).toBe(1);
    await save('payslip.pdf', buffer);
  });
});
