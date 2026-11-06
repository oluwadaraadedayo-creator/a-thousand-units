// @ts-nocheck
// One Supabase Edge Function that serves every endpoint of the old Vercel api folder.
// A small adapter makes the Edge request look like the Node (req, res) the handlers already expect,
// so the payment logic is unchanged. URL: https://<project-ref>.supabase.co/functions/v1/api/<route>
import { Buffer } from 'node:buffer'
import process from 'node:process'
globalThis.Buffer ??= Buffer
globalThis.process ??= process

import banks from './banks.js'
import createSubaccount from './create-subaccount.js'
import initializePayment from './initialize-payment.js'
import paystackWebhook from './paystack-webhook.js'
import report from './report.js'
import verifyPayment from './verify-payment.js'
import registerAudio from './_handlers/register-audio.js'
import removeAudio from './_handlers/remove-audio.js'
import registerPreview from './_handlers/register-preview.js'
import removePreview from './_handlers/remove-preview.js'
import registerArtwork from './_handlers/register-artwork.js'
import download from './_handlers/download.js'
import previews from './_handlers/previews.js'
import apply from './_handlers/apply.js'
import config from './_handlers/config.js'

const ROUTES = {
  'banks': banks, 'create-subaccount': createSubaccount, 'initialize-payment': initializePayment,
  'paystack-webhook': paystackWebhook, 'report': report, 'verify-payment': verifyPayment,
  'register-audio': registerAudio, 'remove-audio': removeAudio, 'register-preview': registerPreview,
  'remove-preview': removePreview, 'register-artwork': registerArtwork, 'download': download,
  'previews': previews, 'apply': apply, 'config': config
}

const plain = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (request) => {
  const url = new URL(request.url)
  const name = url.pathname.split('/').filter(Boolean).pop() || ''
  const fn = Object.prototype.hasOwnProperty.call(ROUTES, name) ? ROUTES[name] : null
  if (!fn) return plain(404, { error: 'Not found' })

  const hasBody = !['GET', 'HEAD', 'OPTIONS'].includes(request.method)
  const raw = hasBody ? new Uint8Array(await request.arrayBuffer()) : new Uint8Array()
  const headers = Object.fromEntries(request.headers)               // keys are lower case
  let body
  // The webhook must see the exact bytes Paystack signed, so its body is never pre-parsed.
  if (name !== 'paystack-webhook' && raw.length && (headers['content-type'] || '').includes('application/json')) {
    try { body = JSON.parse(new TextDecoder().decode(raw)) } catch { body = undefined }
  }
  const req = {
    method: request.method, headers, body, url: request.url, query: Object.fromEntries(url.searchParams),
    async *[Symbol.asyncIterator]() { yield Buffer.from(raw) }
  }

  return await new Promise((resolve) => {
    let status = 200
    const h = new Headers()
    const finish = (payload) => resolve(new Response([204, 304].includes(status) ? null : payload, { status, headers: h }))
    const res = {
      setHeader(k, v) { h.set(k, String(v)); return res },
      status(c) { status = c; return res },
      json(o) { h.set('Content-Type', 'application/json'); finish(JSON.stringify(o ?? null)); return res },
      end(b) { finish(b ?? null); return res }
    }
    Promise.resolve(fn(req, res))
      .then(() => resolve(plain(500, { error: 'No response' })))      // no-op if the handler already replied
      .catch((e) => { console.error('unhandled', name, e); resolve(plain(500, { error: 'Server error' })) })
  })
})
