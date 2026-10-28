// The offer letter of the founder's format as data: the starting content for a new offer (filled
// from the candidate or employee), and its plain text (kept on the letter when it is issued).
// Pure functions, no database.

const DATE = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const longDate = (day) => (day ? DATE.format(new Date(`${day}T00:00:00Z`)) : '');

const WORK_MODE_WORDS = {
  office: 'Work from office',
  remote: 'Work from home',
  hybrid: 'Hybrid (office and home)',
  field: 'Field work',
};

const RUPEES = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/**
 * The content of a new offer letter.
 * @param {{ person: object, company: object, managerName?: string, today: string,
 *   ctcAnnualPaise?: number|null }} input
 */
export function defaultOfferContent({ person, company, managerName = '', today, ctcAnnualPaise }) {
  const companyName = company.shortName || company.name || 'White Gloves Technology Pvt. Ltd.';
  const designation = person.designation || '____________________';
  const firstName = String(person.name ?? '').split(/\s+/)[0];
  const ctc = ctcAnnualPaise
    ? `INR ${RUPEES.format(ctcAnnualPaise / 100)} per annum`
    : 'INR ____________________ per annum';
  return {
    toName: person.name ?? '',
    toAddress: person.currentAddress || person.address || '',
    date: today,
    subject: `Offer of Employment – ${designation}`,
    salutation: firstName,
    intro: `We are pleased to offer you employment with **${companyName}** for the position of **${designation}**. Based on your skills, experience and suitability for the role, we are confident that you will make a valuable contribution to the growth and success of our organisation.`,
    sections: [
      {
        type: 'table',
        title: 'Position details',
        rows: [
          { label: 'Job Title', value: designation },
          {
            label: 'Start Date',
            value: longDate(person.expectedJoiningDate || person.joiningDate) || '____________',
          },
          { label: 'Work Mode', value: WORK_MODE_WORDS[person.workMode] ?? 'Work from office' },
          { label: 'Working Hours', value: '10:00 AM to 7:00 PM' },
          { label: 'Probation Period', value: '3 months' },
          { label: 'Reporting Manager', value: managerName || '____________' },
        ],
      },
      {
        type: 'table',
        title: 'Compensation package',
        rows: [
          { label: 'Annual CTC (during probation)', value: ctc },
          {
            label: 'Performance Incentive',
            value:
              'Up to INR 1,00,000 per month, based on individual performance and applicable company incentive policies',
          },
        ],
      },
      {
        type: 'bullets',
        title: 'Core responsibilities',
        items: [
          'Identify, develop and pursue new franchise opportunities.',
          'Build and maintain strong relationships with prospective franchisees.',
          'Conduct market research to identify potential franchise markets and business opportunities.',
          'Provide appropriate support and guidance to franchisees to facilitate their success.',
          'Achieve assigned sales targets and contribute to the overall growth of the Company.',
        ],
      },
      {
        type: 'paragraphs',
        title: 'Probation period',
        paragraphs: [
          'Your employment will initially be subject to a probationary period of three (3) months, during which your performance, conduct, attendance and adherence to Company policies will be evaluated. Upon successful completion of the probation period, your employment will be confirmed in accordance with Company policy.',
          'If you resign from your employment without providing the required 30-day notice period, the Company reserves the right to recover or adjust applicable dues, including salary or other amounts, to the extent permitted under applicable law and Company policy.',
        ],
      },
      {
        type: 'terms',
        title: 'Terms and conditions',
        items: [
          {
            title: 'Working Days',
            text: 'You will be required to work six (6) days per week. Additional working hours or overtime may be required based on business requirements and applicable Company policy.',
          },
          {
            title: 'Leave Policy',
            text: 'You will be entitled to twelve (12) days of paid leave per year, prorated during your first year of employment. All leave requests are subject to prior approval from your Reporting Manager.',
          },
          {
            title: 'Confidentiality',
            text: 'You must maintain strict confidentiality regarding all proprietary information, business information, customer information, trade secrets and other confidential information of the Company during and after your employment. You will be required to sign a Non-Disclosure Agreement (NDA) on your first working day.',
          },
          {
            title: 'Non-Compete / Conflict of Interest',
            text: "During your employment, you shall not engage in any business activity that conflicts with or competes with the Company's business, subject to applicable law. Any post-employment restriction shall apply only to the extent permitted by applicable law.",
          },
          {
            title: 'Performance and Conduct',
            text: "Your continued employment will be subject to satisfactory performance, professional conduct, attendance and compliance with the Company's policies and procedures.",
          },
          {
            title: 'Termination',
            text: 'If your performance during the initial period of employment is found to be unsatisfactory, including within the first fifteen (15) days, the Company may take appropriate action, including termination, in accordance with applicable law and Company policy. Any settlement or withholding of dues will be handled in accordance with applicable law and Company policy.',
          },
        ],
      },
    ],
    closing: [
      'Please retain one copy of this letter for your records and return a signed copy to the Company.',
      `If you have any questions or require any clarification regarding this offer, please feel free to contact us. We look forward to welcoming you to ${companyName} and wish you a successful and rewarding career with us.`,
    ],
    signOff: {
      greeting: 'Warm regards,',
      forLine: `For ${companyName}`,
      name: company.signatoryName || 'Muskan',
      title: company.signatoryTitle || `Human Resources, ${companyName}`,
      showStamp: true,
    },
    acceptance: {
      show: true,
      text: `I, **${person.name ?? ''}**, hereby accept the offer of employment as **${designation}** with **${companyName}** and agree to abide by the terms and conditions stated in this Offer of Employment and the applicable policies of the Company.`,
      name: person.name ?? '',
    },
  };
}

const plain = (text) => String(text ?? '').replace(/\*\*([^*]+)\*\*/g, '$1');

/** The letter as plain text (stored when issued, for search and the audit trail). */
export function offerContentText(content) {
  const lines = [
    `To, ${content.toName}${content.toAddress ? `, ${content.toAddress}` : ''}`,
    `Date: ${longDate(content.date)}`,
    `Subject: ${content.subject}`,
    '',
    `Dear ${content.salutation},`,
    plain(content.intro),
  ];
  content.sections.forEach((section, index) => {
    lines.push('', `${String(index + 1).padStart(2, '0')} ${section.title.toUpperCase()}`);
    if (section.type === 'table')
      section.rows.forEach((row) => lines.push(`${row.label}: ${row.value}`));
    if (section.type === 'bullets') section.items.forEach((item) => lines.push(`- ${plain(item)}`));
    if (section.type === 'paragraphs')
      section.paragraphs.forEach((text) => lines.push(plain(text)));
    if (section.type === 'terms')
      section.items.forEach((item) => lines.push(`${item.title}. ${item.text}`));
  });
  lines.push(
    '',
    ...content.closing.map(plain),
    '',
    content.signOff.greeting,
    content.signOff.forLine,
  );
  lines.push(content.signOff.name, content.signOff.title);
  if (content.acceptance.show)
    lines.push('', 'ACCEPTANCE OF OFFER', plain(content.acceptance.text));
  return lines.join('\n');
}
