import { describe, expect, it } from 'vitest';
import { GET as listRoute, POST as addRoute } from '@/app/api/candidates/route.js';
import { GET as getRoute } from '@/app/api/candidates/[id]/route.js';
import { POST as letterRoute } from '@/app/api/candidates/[id]/letters/route.js';
import { POST as joinRoute } from '@/app/api/candidates/[id]/join/route.js';
import { POST as dropRoute } from '@/app/api/candidates/[id]/drop/route.js';
import { GET as getLetterRoute } from '@/app/api/letters/[id]/route.js';
import { POST as letterAction } from '@/app/api/letters/[id]/[action]/route.js';
import { Lookup } from '@/server/models/lookup.model.js';
import { Letter } from '@/server/models/letter.model.js';
import { User } from '@/server/models/user.model.js';
import { seedLetterTemplates, listTemplates } from '@/server/services/letters.service.js';
import { updateCompany } from '@/server/services/settings.service.js';
import { call, makeUser } from './helpers.js';

const action = (user, id, name, body) =>
  call(letterAction, { method: 'POST', user, params: { id, action: name }, body });

async function setup() {
  await Lookup.insertMany([
    { type: 'designation', name: 'Field Executive' },
    { type: 'department', name: 'Operations' },
    { type: 'branch', name: 'Noida' },
  ]);
  await seedLetterTemplates();
  const hr = await makeUser({ roleKey: 'hr_admin', name: 'Ravi HR' });
  await updateCompany(hr, {
    name: 'Mr. White Gloves',
    address: 'Sector 18, Noida',
    signatoryName: 'Asha',
    signatoryTitle: 'CEO',
  });
  const offerTemplate = (await listTemplates()).find((template) => template.kind === 'offer');
  const added = await call(addRoute, {
    method: 'POST',
    user: hr,
    body: {
      name: 'Kiran Rao',
      phone: '9876543210',
      email: 'kiran@example.com',
      designation: 'Field Executive',
      department: 'Operations',
      branch: 'Noida',
      expectedJoiningDate: '2026-11-10',
    },
  });
  return { hr, candidate: added.body.candidate, offerTemplate };
}

async function issuedOffer(hr, candidate, offerTemplate) {
  const drafted = await call(letterRoute, {
    method: 'POST',
    user: hr,
    params: { id: candidate._id },
    body: {
      templateId: String(offerTemplate._id),
      fields: {
        ctcAnnual: 360000,
        probationMonths: 6,
        joiningDate: '2026-11-10',
        acceptBy: '2026-11-01',
      },
    },
  });
  const id = String(drafted.body.letter._id);
  const issued = await action(hr, id, 'issue');
  return { id, issued };
}

describe('hiring', () => {
  it('drafts and issues an offer letter for a candidate from the template', async () => {
    const { hr, candidate, offerTemplate } = await setup();
    const { id, issued } = await issuedOffer(hr, candidate, offerTemplate);
    expect(issued.status).toBe(200);
    expect(issued.body.letter.status).toBe('issued');
    expect(issued.body.letter.body).toContain('Dear Kiran Rao');
    expect(issued.body.letter.body).toContain('₹3,60,000');
    expect(issued.body.employee).toMatchObject({ name: 'Kiran Rao', candidateId: candidate._id });
    const list = await call(listRoute, { user: hr });
    expect(list.body.items[0].offer).toMatchObject({ status: 'issued', version: 1 });
    expect((await call(getLetterRoute, { user: hr, params: { id } })).status).toBe(200);
  });

  it('only recruitment people see a candidate and their letters', async () => {
    const { hr, candidate, offerTemplate } = await setup();
    const { id } = await issuedOffer(hr, candidate, offerTemplate);
    const staff = await makeUser();
    const manager = await makeUser({ roleKey: 'manager' });
    expect((await call(getRoute, { user: manager, params: { id: candidate._id } })).status).toBe(
      403,
    );
    expect((await call(getLetterRoute, { user: staff, params: { id } })).status).toBe(404);
    expect((await action(staff, id, 'respond', { decision: 'accepted', note: '' })).status).toBe(
      404,
    );
  });

  it('joins only after the offer is accepted; joining makes the employee and moves the letters', async () => {
    const { hr, candidate, offerTemplate } = await setup();
    const join = () =>
      call(joinRoute, {
        method: 'POST',
        user: hr,
        params: { id: candidate._id },
        body: { joiningDate: '2026-11-10', password: 'welcome-123' },
      });
    const { id } = await issuedOffer(hr, candidate, offerTemplate);
    expect((await join()).status).toBe(409);

    await action(hr, id, 'respond', { decision: 'accepted', note: 'Signed on WhatsApp' });
    const joined = await join();
    expect(joined.status).toBe(200);
    const employee = joined.body.employee;
    expect(employee).toMatchObject({
      name: 'Kiran Rao',
      designation: 'Field Executive',
      joiningDate: '2026-11-10',
      employmentStatus: 'probation',
      personalEmail: 'kiran@example.com',
    });
    expect(employee.employeeId).toMatch(/^MWG-\d{3}$/);
    const letter = await Letter.findById(id).lean();
    expect(String(letter.userId)).toBe(String(employee._id));
    expect(letter.employeeId).toBe(employee.employeeId);

    // Twice never makes two employees.
    expect((await join()).status).toBe(409);
    expect(await User.countDocuments({ name: 'Kiran Rao' })).toBe(1);
  });

  it('keeps a candidate who will not join, with the reason', async () => {
    const { hr, candidate } = await setup();
    const dropped = await call(dropRoute, {
      method: 'POST',
      user: hr,
      params: { id: candidate._id },
      body: { reason: 'declined', note: 'Took another job' },
    });
    expect(dropped.body.candidate).toMatchObject({ status: 'dropped', dropReason: 'declined' });
    const again = await call(dropRoute, {
      method: 'POST',
      user: hr,
      params: { id: candidate._id },
      body: { reason: 'other' },
    });
    expect(again.status).toBe(409);
  });

  it('refuses a designation that is not in the lists', async () => {
    const { hr } = await setup();
    const result = await call(addRoute, {
      method: 'POST',
      user: hr,
      body: { name: 'Someone', designation: 'Astronaut' },
    });
    expect(result.status).toBe(400);
  });
});
