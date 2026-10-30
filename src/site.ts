// Your business details. The legal pages read from here.
// Replace every value in [square brackets]. While any bracket remains, the legal pages show a "Draft" banner.
// Have a lawyer review the Terms, Privacy and Refund pages before launch.
export const SITE = {
  name: 'A Thousand Units',
  legalName: '[Registered company name]',
  email: '[support email address]',
  address: '[Registered business address]',
  country: 'Nigeria',
  platformFee: '[platform fee, for example 10%]',
  refundDays: '[7]',
  retention: '[how long, for example 7 years]',
  updated: '30 October 2026'
}
export const isPlaceholder = (v: string) => /^\[.*\]$/.test(v.trim())
export const hasPlaceholders = Object.values(SITE).some(isPlaceholder)
export const contactEmail = isPlaceholder(SITE.email) ? '' : SITE.email
