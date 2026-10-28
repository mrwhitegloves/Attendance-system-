// The two brands of White Gloves Technology Private Limited (one legal company, one GST): the
// parent brand Mr. White Gloves and EngenX. Every employee and candidate belongs to one; it
// decides the logo and the header line of their offer letter and salary slip. The words
// (name, website, email, tagline) are edited in Settings → Company; the logos are files here.

export const BRANDS = {
  mwg: {
    label: 'Mr. White Gloves',
    // Letter header logo, and its size on the page in points (from the founder's .docx format).
    letterLogo: '/brands/mwg-letter.png',
    logoWidth: 49.5,
    logoHeight: 34.5,
    defaults: {
      name: 'Mr. White Gloves',
      website: 'www.mrwhitegloves.com',
      email: 'franchise@mrwhitegloves.com',
      tagline: 'WE RENEW YOUR CAR',
    },
  },
  engenx: {
    label: 'EngenX',
    letterLogo: '/brands/engenx-letter.png',
    logoWidth: 105.7,
    logoHeight: 34.5,
    defaults: {
      name: 'EngenX',
      website: 'www.engenx.in',
      email: 'franchise@mrwhitegloves.com',
      tagline: '',
    },
  },
};

export const BRAND_KEYS = Object.keys(BRANDS);
export const DEFAULT_BRAND = 'mwg';
export const brandOptions = BRAND_KEYS.map((value) => ({ value, label: BRANDS[value].label }));
/** An employee's or candidate's brand key (old records have none: the parent brand). */
export const brandKeyOf = (person) => (BRANDS[person?.brandKey] ? person.brandKey : DEFAULT_BRAND);
