// Draft terms for creators who upload audio. Have a lawyer review the wording before launch.
export const UPLOADER_TERMS_VERSION = '2026-11-01'
export const UPLOADER_TERMS: string[] = [
  'You must own or control all rights in everything you upload, including the audio, artwork and text, and every sample, beat, vocal and other recording inside it.',
  'You must not upload anything that infringes someone else\'s rights or that is unlawful.',
  'DJ mixes and remixes may only be uploaded if every recording in them is your own original work or you hold written permission from the rights holders.',
  'Buyers receive the files you upload. Only upload files you are happy to deliver, and do not remove files from a release that has sold.',
  'We may remove a release after a complaint and may suspend an account after repeated complaints. Three removals lead to suspension.',
  'You are responsible for any claim that arises from your uploads, and you agree to respond to complaints promptly.',
  'If you believe a removal was a mistake, contact us with your explanation and we will review it.'
]
export const rightsStatement = (categorySlug?: string) => categorySlug === 'music_dj'
  ? 'I confirm that every recording in this mix is my own original work, or I hold written permission from the rights holders to sell it.'
  : 'I confirm that I own or control all rights to this audio, including any samples, and I am allowed to sell it.'
