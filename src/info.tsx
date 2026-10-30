import { ArrowLeft } from 'lucide-react'
import { SITE, hasPlaceholders } from './site'

export type InfoKind = 'terms' | 'privacy' | 'refunds' | 'about' | 'help'
type Block = { h: string; p?: string[]; list?: string[]; link?: [string, string] }
type Doc = { title: string; kicker: string; legal?: boolean; blocks: Block[] }

const DOCS: Record<InfoKind, Doc> = {
  terms: {
    title: 'Terms of Use', kicker: 'LEGAL', legal: true, blocks: [
      { h: 'Who we are', p: [`${SITE.name} is an online store where independent artists sell digital music directly to fans. These terms are an agreement between you and ${SITE.legalName}. By creating an account, buying a release or uploading music, you agree to them.`] },
      { h: 'Your account', p: ['You must be old enough to enter a binding contract where you live. Give accurate details and keep your password private. You are responsible for what happens under your account. Tell us at once if you think someone else has used it.'] },
      { h: 'Buying music', list: [
        'Prices are shown in naira (NGN). Payments are made through Paystack. We confirm each payment with Paystack before we unlock a release.',
        'A purchase gives you a personal licence to listen to the release and keep a copy for your own non-commercial use. You do not own the copyright and you may not resell, share or publish the files.',
        'Some releases are pay what you want. You choose a price per unit, at or above the artist\'s minimum. You can buy up to 10 units in one order. You always receive one copy. Extra units are extra support for the artist and count toward the artist\'s campaign goal.',
        'You can buy each release once per account.'] },
      { h: 'Downloads and your library', p: ['Your purchases appear in My Library. Download links expire after 10 minutes for security, and you can ask for new links at any time while you own the release. If a release is removed after a rights complaint, you will lose access to its files and we will refund you.'] },
      { h: 'Campaigns and plaques', p: ['Artists can run campaigns with a goal in units. Units are confirmed 7 days after payment. Purchases made by the artist and refunded orders do not count. Plaques recognise milestones on this site. They are not an official certification, chart or sales award, and we may withhold or remove one if we believe the count was manipulated.'] },
      { h: 'For artists', list: [
        'You must own or control all rights in what you upload, including any samples, and you must accept the uploader terms before you publish.',
        'DJ mixes may only be uploaded if every recording in them is your own or you hold written permission.',
        `We charge a platform fee of ${SITE.platformFee} on each sale. Payments are split automatically and your share is paid to your bank account through Paystack.`,
        'Previews you upload can be played by anyone, so only upload clips you are happy to share.',
        'We may remove a release after a valid complaint. Three removals lead to suspension.',
        'You are responsible for any claim that arises from your uploads.'] },
      { h: 'Copyright complaints', p: ['If you believe a release uses your work without permission, use the report link at the bottom of the release page. We review each report, may remove the release while we do, and may suspend repeat offenders. If you are an artist and believe a removal was a mistake, email us with your explanation and we will review it.'] },
      { h: 'What you must not do', list: [
        'Break the law or infringe anyone\'s rights.',
        'Share, resell or publish purchased files, or share download links.',
        'Try to get around limits, links or payment checks, or to reach files you have not bought.',
        'Manipulate campaign counts, for example by buying your own release through other accounts.',
        'Harass others, upload harmful files or misuse the report form.'], p: ['We may suspend or close accounts that do.'] },
      { h: 'Refunds', p: ['Our refund and delivery policy explains when we refund a purchase.'], link: ['Read the refund and delivery policy', '#/refunds'] },
      { h: 'Our responsibility', p: ['We provide the service as it is. We work to keep it running but cannot promise it will always be available or free of errors. Nothing in these terms limits liability that cannot legally be limited. Subject to that, we are not liable for indirect or consequential losses, and our total liability for a claim about a purchase is limited to the amount you paid for that purchase.'] },
      { h: 'Ending your account', p: ['You can stop using the service at any time. We may suspend or close an account that breaks these terms. Parts of these terms that are meant to continue, such as licences, liability and complaints, continue after that.'] },
      { h: 'Governing law', p: [`These terms are governed by the laws of ${SITE.country}. Disputes are for the courts of ${SITE.country}, unless the law gives you the right to go elsewhere.`] },
      { h: 'Changes and contact', p: [`We may update these terms. The date at the top shows the latest version, and continuing to use the service means you accept it. Questions: ${SITE.email}.`] }
    ]
  },
  privacy: {
    title: 'Privacy Policy', kicker: 'LEGAL', legal: true, blocks: [
      { h: 'Who we are', p: [`${SITE.legalName} runs ${SITE.name} and decides how your personal data is used. Contact: ${SITE.email}, ${SITE.address}.`] },
      { h: 'What we collect', list: [
        'Account: your email, display name and password. Your password is stored in scrambled form by our sign-in provider. We cannot read it.',
        'Purchases: what you bought, when, how much, how many units, and a payment reference. Your card or bank details are entered on Paystack\'s page and never reach us.',
        'Activity: which artists you follow, and which files you request and when. We use this to deliver downloads and to spot abuse.',
        'Artists: your public profile, releases and uploads, and for payouts the account name, the last four digits of your account number and a payout reference. Your full account number goes straight to Paystack.',
        'Reports: if you report a release, your name, email, statement, and a scrambled version of your connection address to limit abuse.',
        'Device: your browser keeps a sign-in token in local storage, and our servers keep short-lived technical logs.'] },
      { h: 'How we use it', list: [
        'To deliver your purchases and downloads and to process payments and payouts.',
        'To keep accounts secure and to prevent fraud and abuse.',
        'To handle copyright reports and meet our legal duties.',
        'To email you about your account, such as a password reset.'], p: ['We do not sell your data and we do not use advertising trackers.'] },
      { h: 'Who receives it', list: [
        'Supabase, which hosts our database, sign-in and private file storage.',
        'Paystack, which processes payments and payouts.',
        'Vercel, which runs our server functions, and GitHub, which hosts this website.',
        'Google Fonts: your browser requests our fonts from Google, which can see your connection address.',
        'Artists see how many units and how much their releases earned. They do not receive your email address.',
        'Authorities, when the law requires it.'] },
      { h: 'Where it is processed', p: ['Our providers may process data in other countries. We use providers that publish their security practices.'] },
      { h: 'How long we keep it', p: [`Account and purchase records are kept while your account is open and for ${SITE.retention} afterwards for accounting and disputes. Download logs and report records are kept no longer than needed to protect the service.`] },
      { h: 'Your rights', p: ['You can ask to see, correct or delete your data, or object to how we use it, by emailing us. We reply within a reasonable time and tell you if the law requires us to keep something. You can also complain to the data protection regulator in your country.'] },
      { h: 'Security', p: ['Files are stored privately and shared only through short-lived links, and database rules limit who can read what. No system is perfectly secure, so use a strong password that you do not use elsewhere.'] },
      { h: 'Children', p: ['This service is not for children. If you think a child has given us personal data, contact us and we will remove it.'] },
      { h: 'Changes', p: ['We may update this policy. The date at the top shows the latest version.'] }
    ]
  },
  refunds: {
    title: 'Refund and Delivery Policy', kicker: 'LEGAL', legal: true, blocks: [
      { h: 'Delivery', p: ['Digital releases are delivered at once. When Paystack confirms your payment, the release appears in My Library and you can play it and download the files. If it does not appear within a few minutes, refresh the page, then contact us with your payment reference.'] },
      { h: 'When we refund', list: [
        'You were charged twice for the same release.',
        'You paid but the release was not delivered and we cannot fix it within 3 days.',
        'The files are damaged or incomplete and the artist does not fix them within 7 days.',
        'The release was removed after a rights complaint.',
        `You bought by mistake and email us within ${SITE.refundDays} days, before downloading the files.`] },
      { h: 'When we do not', p: ['Files can be copied once they are downloaded, so we do not refund a change of mind after you have downloaded the full files. Nothing in this policy limits rights you have under consumer law.'] },
      { h: 'How to ask', p: [`Email ${SITE.email} from the address on your account and include your payment reference. We aim to reply within 2 working days.`] },
      { h: 'How refunds are paid', p: ['Refunds go back to the original payment method through Paystack. Banks decide how long they take to show it, often several working days.'] },
      { h: 'Units and campaigns', p: ['If an order is refunded, its units no longer count toward the artist\'s campaign, and a plaque that depended on them may be withdrawn.'] },
      { h: 'Chargebacks', p: ['If you dispute a payment with your bank, we may suspend access to the release until the dispute is settled.'] }
    ]
  },
  about: {
    title: 'About A Thousand Units', kicker: 'ABOUT', blocks: [
      { h: 'Why we exist', p: ['Independent music deserves a direct line to its people. A Thousand Units lets artists sell what they make straight to the fans who care, set their own prices and keep the relationship.'] },
      { h: 'For fans', list: ['Buy a release once and it is yours. It lives in your library and you can download it.', 'Follow the artists you love.', 'On some releases you can pay what you want, and back an artist with extra units to help them reach a goal.'] },
      { h: 'For artists', list: ['Upload your music, set your price or let fans choose it, and add short previews.', 'Run campaigns with goals and earn plaques at milestones.', 'Sales are split automatically and paid to your bank through Paystack.'] },
      { h: 'Contact', p: [`${SITE.email}`, `${SITE.legalName}, ${SITE.address}`] }
    ]
  },
  help: {
    title: 'Help', kicker: 'HELP', blocks: [
      { h: 'I paid but my release is not in my library', p: [`Refresh My Library after a minute. If it is still missing, email ${SITE.email} with your payment reference.`] },
      { h: 'How do I download my music?', p: ['Open the release from My Library and press Get my files. The links last 10 minutes. Press Refresh links for new ones.'] },
      { h: 'I forgot my password', p: ['On the sign-in page choose Forgot password and we will email you a link to set a new one. Check your spam folder if it does not arrive.'] },
      { h: 'What does pay what you want mean?', p: ['Some artists let you choose the price, above their minimum. You can also buy up to 10 units in one order. You always get one copy. Extra units are extra support for the artist.'] },
      { h: 'What are units, campaigns and plaques?', p: ['An artist can set a goal in units for a release. Each unit bought counts toward it once it is confirmed, 7 days after payment. When milestones are reached, the artist earns plaques that show on their page.'] },
      { h: 'Can I listen before I buy?', p: ['Many releases have short previews on their page. Look for Listen before you buy.'] },
      { h: 'How do I become an artist?', p: [`Create an account, then email ${SITE.email}. Artist accounts are approved by our team.`] },
      { h: 'How do I report a release?', p: ['Use the report link at the bottom of the release page and tell us what the problem is.'], link: ['Read our terms', '#/terms'] },
      { h: 'How do I contact you?', p: [`${SITE.email}`] }
    ]
  }
}

export function InfoPage({ kind, onBack }: { kind: InfoKind; onBack: () => void }) {
  const d = DOCS[kind]
  return <main className="page-main info-page">
    <button className="back-link" onClick={onBack}><ArrowLeft size={16} /> Back to Explore</button>
    <span className="section-kicker">{d.kicker}</span>
    <h1>{d.title}</h1>
    {d.legal && <p className="info-updated">Last updated {SITE.updated}</p>}
    {hasPlaceholders && <div className="draft-banner"><b>Draft.</b> Fill in your business details in <code>src/site.ts</code> and have a lawyer review this page before launch.</div>}
    {d.blocks.map(b => <section key={b.h} className="info-block"><h2>{b.h}</h2>{b.p?.map(t => <p key={t}>{t}</p>)}{b.list && <ul>{b.list.map(t => <li key={t}>{t}</li>)}</ul>}{b.link && <p><a className="text-link" href={b.link[1]}>{b.link[0]}</a></p>}</section>)}
  </main>
}
