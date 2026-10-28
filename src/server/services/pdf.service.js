import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createElement } from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { getFileBytes } from '../infra/storage.js';
import { createAppError } from '../lib/errors.js';
import { OfferLetterDocument } from '../../features/letters/pdf/OfferLetterDocument.jsx';
import { PayslipDocument } from '../../features/payslips/pdf/PayslipDocument.jsx';
import { getLetter } from './letters.service.js';
import { getPayslip } from './payslips.service.js';
import { brandFor, getCompany } from './settings.service.js';

// PDF files of letters and salary slips. The same document components make the preview on the
// screen, so the file always looks like the preview. Pictures: the brand logo (a public file)
// and the company stamp (private, from storage).

const logoCache = new Map();

/** A brand logo from the public folder, as bytes react-pdf can draw. */
export async function brandLogo(brand) {
  if (!logoCache.has(brand.letterLogo)) {
    const file = path.join(process.cwd(), 'public', brand.letterLogo);
    logoCache.set(brand.letterLogo, await readFile(file).catch(() => null));
  }
  const data = logoCache.get(brand.letterLogo);
  return data ? { data, format: 'png' } : null;
}

/** The company stamp (Settings → Company), or null when none is uploaded. */
export async function companyStamp(company) {
  const bytes = await getFileBytes(company.stampKey).catch(() => null);
  if (!bytes) return null;
  return { data: bytes, format: company.stampKey.endsWith('.jpg') ? 'jpg' : 'png' };
}

/** The same pictures as data URLs, for the preview in the browser (which cannot read S3). */
export async function pictureDataUrl(picture) {
  if (!picture) return null;
  return `data:image/${picture.format === 'jpg' ? 'jpeg' : 'png'};base64,${picture.data.toString('base64')}`;
}

const fileName = (text) =>
  `${String(text)
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)}.pdf`;

/** The PDF of a letter in the offer format (access checked by getLetter). */
export async function letterPdf(actor, id) {
  const data = await getLetter(actor, id);
  if (data.letter.layout !== 'offer_format') {
    throw createAppError(400, 'This letter has no PDF. Use Print instead.');
  }
  const [logoSrc, stampSrc] = await Promise.all([
    brandLogo(data.brand),
    companyStamp(data.company),
  ]);
  const buffer = await renderToBuffer(
    createElement(OfferLetterDocument, {
      content: data.letter.content,
      company: data.company,
      brand: data.brand,
      logoSrc,
      stampSrc,
      draft: data.letter.status === 'draft',
    }),
  );
  return {
    buffer,
    fileName: fileName(`Offer-letter-${data.employee.name}-v${data.letter.version}`),
  };
}

/** The PDF of a salary slip (access checked by getPayslip). */
export async function payslipPdf(actor, id) {
  const slip = await getPayslip(actor, id, { full: true });
  const company = slip.status === 'final' && slip.company?.name ? slip.company : await getCompany();
  const live = await getCompany();
  const brand = brandFor(live, { brandKey: slip.employee.brandKey });
  const [logoSrc, stampSrc] = await Promise.all([brandLogo(brand), companyStamp(live)]);
  const buffer = await renderToBuffer(
    createElement(PayslipDocument, { slip, company, brand, logoSrc, stampSrc }),
  );
  return { buffer, fileName: fileName(`Salary-slip-${slip.employee.name}-${slip.month}`) };
}
