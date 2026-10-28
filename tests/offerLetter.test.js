import { describe, expect, it } from 'vitest';
import { POST as addCandidate } from '@/app/api/candidates/route.js';
import { POST as newOffer } from '@/app/api/candidates/[id]/offer-letters/route.js';
import { PUT as saveContent } from '@/app/api/letters/[id]/content/route.js';
import { GET as letterPdfRoute } from '@/app/api/letters/[id]/pdf/route.js';
import { GET as getLetterRoute } from '@/app/api/letters/[id]/route.js';
import { POST as letterAction } from '@/app/api/letters/[id]/[action]/route.js';
import { PATCH as companyRoute } from '@/app/api/settings/company/route.js';
import { SESSION_COOKIE, createSession } from '@/server/auth/session.js';
import { call, makeUser } from './helpers.js';

async function setup() {
  const hr = await makeUser({ roleKey: 'hr_admin', name: 'Ravi HR' });
  await call(companyRoute, {
    method: 'PATCH',
    user: hr,
    body: {
      name: 'White Gloves Technology Private Limited',
      shortName: 'White Gloves Technology Pvt. Ltd.',
      cin: 'U50400JH2021PTC017561',
      brands: { engenx: { website: 'www.engenx.in' } },
    },
  });
  const candidate = (
    await call(addCandidate, {
      method: 'POST',
      user: hr,
      body: { name: 'Vivek Rajak', address: 'Jamshedpur, Jharkhand', brandKey: 'engenx' },
    })
  ).body.candidate;
  const letter = (await call(newOffer, { method: 'POST', user: hr, params: { id: candidate._id } }))
    .body.letter;
  return { hr, candidate, letter };
}

/** Calls the PDF route and returns the status, type and first bytes. */
async function fetchPdf(user, id) {
  const cookie = `${SESSION_COOKIE}=${await createSession(user._id)}`;
  const response = await letterPdfRoute(
    new Request(`http://localhost/api/letters/${id}/pdf?download=1`, { headers: { cookie } }),
    { params: Promise.resolve({ id }) },
  );
  const bytes = Buffer.from(await response.arrayBuffer());
  return {
    status: response.status,
    type: response.headers.get('content-type'),
    disposition: response.headers.get('content-disposition'),
    start: bytes.subarray(0, 4).toString(),
  };
}

describe('offer letter in the company format', () => {
  it('starts from the format, filled from the candidate, with the candidate’s company', async () => {
    const { letter } = await setup();
    expect(letter).toMatchObject({ layout: 'offer_format', brandKey: 'engenx', status: 'draft' });
    expect(letter.content.toName).toBe('Vivek Rajak');
    expect(letter.content.toAddress).toBe('Jamshedpur, Jharkhand');
    expect(letter.content.intro).toContain('**White Gloves Technology Pvt. Ltd.**');
    expect(letter.content.sections.map((section) => section.type)).toEqual([
      'table',
      'table',
      'bullets',
      'paragraphs',
      'terms',
    ]);
  });

  it('saves edited content; issuing freezes it as text; the PDF downloads', async () => {
    const { hr, letter } = await setup();
    const content = {
      ...letter.content,
      subject: 'Offer of Employment – Sales Executive',
      sections: [
        ...letter.content.sections,
        { type: 'bullets', title: 'Documents to bring', items: ['PAN card', 'Aadhaar card'] },
      ],
    };
    const saved = await call(saveContent, {
      method: 'PUT',
      user: hr,
      params: { id: String(letter._id) },
      body: { content, brandKey: 'mwg' },
    });
    expect(saved.status).toBe(200);
    expect(saved.body.letter.brandKey).toBe('mwg');

    const pdf = await fetchPdf(hr, String(letter._id));
    expect(pdf).toMatchObject({ status: 200, type: 'application/pdf', start: '%PDF' });
    expect(pdf.disposition).toContain('attachment');

    const issued = await call(letterAction, {
      method: 'POST',
      user: hr,
      params: { id: String(letter._id), action: 'issue' },
    });
    expect(issued.body.letter.status).toBe('issued');
    expect(issued.body.letter.body).toContain('06 DOCUMENTS TO BRING');
    expect(issued.body.letter.body).toContain('- PAN card');
    // Issued: the content cannot change any more.
    const late = await call(saveContent, {
      method: 'PUT',
      user: hr,
      params: { id: String(letter._id) },
      body: { content },
    });
    expect(late.status).toBe(409);
  });

  it('refuses content that does not fit the format', async () => {
    const { hr, letter } = await setup();
    const bad = await call(saveContent, {
      method: 'PUT',
      user: hr,
      params: { id: String(letter._id) },
      body: { content: { ...letter.content, sections: [{ type: 'video', title: 'x' }] } },
    });
    expect(bad.status).toBe(400);
  });

  it('only recruitment people see a candidate’s offer letter or its PDF', async () => {
    const { letter } = await setup();
    const staff = await makeUser();
    expect(
      (await call(getLetterRoute, { user: staff, params: { id: String(letter._id) } })).status,
    ).toBe(404);
    expect((await fetchPdf(staff, String(letter._id))).status).toBe(404);
  });
});
