// Your business details. The legal pages read from here.
// Replace every value in [square brackets]. While any bracket remains, the legal pages show a "Draft" banner.
// Have a lawyer review the Terms, Privacy and Refund pages before launch.
export const SITE = {
  name: 'A Thousand Units',
  legalName: 'A Thousand Units Ltd',
  email: 'hello@athousandunits.com',
  address: '12 Example Street, Lagos, Nigeria',
  country: 'Nigeria',
  platformFee: '20%',
  refundDays: '7',
  retention: '7 years',
  updated: '30 October 2026'
}
export const isPlaceholder = (v: string) => /^\[.*\]$/.test(v.trim())
export const hasPlaceholders = Object.values(SITE).some(isPlaceholder)
export const contactEmail = isPlaceholder(SITE.email) ? '' : SITE.email
