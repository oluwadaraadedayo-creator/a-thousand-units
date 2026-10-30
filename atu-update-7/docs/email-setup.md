# Email setup

## What gets sent

A receipt to the buyer when a payment is confirmed (once per order, even if the callback and the webhook both arrive).
An alert to you when someone files a copyright report.
Sign-up confirmation and password-reset emails, if you also connect Supabase (step 4).

Sending email never blocks a payment or a report. If the email service is down or not set up, the payment still goes through and the report is still saved. A failed receipt is retried the next time that order is confirmed.

Provider: Resend (resend.com). I could not check Resend's pricing, free limits or exact screen names from where I work, so confirm them on their site.

## Steps

1. Resend: create an account, add the domain you want to send from, and add the DNS records it shows you (they prove you own the domain and sign your mail). Wait until it says verified. Also add a DMARC record at your DNS host: a TXT record named `_dmarc` with the value `v=DMARC1; p=none; rua=mailto:you@yourdomain.com`. Then create an API key that can send email.

2. Supabase SQL Editor: run `supabase/migrations/008_email.sql` once.

3. Vercel, in the project that runs your main site's `api` folder, add these Environment Variables and redeploy:
   - `RESEND_API_KEY`: the key from Resend. Secret. Never put it in the repo or in a `VITE_` variable.
   - `EMAIL_FROM`: for example `A Thousand Units <hello@yourdomain.com>`. The address must be on the domain you verified.
   - `SITE_URL`: your public site address, for example `https://oluwadaraadedayo-creator.github.io/a-thousand-units`
   - `ADMIN_URL`: your admin app address.
   - `ADMIN_ALERT_EMAIL`: where report alerts go. Up to 5 addresses, separated by commas.
   - `EMAIL_REPLY_TO` (optional): where replies to receipts go, for example your support address.

4. Supabase account emails (sign-up confirmation, password reset). In the Supabase dashboard, open Authentication, then the email or SMTP settings, and turn on custom SMTP:
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: your Resend API key
   - Sender email: the same address as `EMAIL_FROM`
   Check Resend's SMTP page to confirm these values, and check the email rate limit setting in Supabase after you switch on custom SMTP.

5. Test it. Buy a release with your Paystack test key and check your inbox for the receipt. File a report on a release and check for the alert. If anything is missing, look at the log in the Supabase SQL Editor:

```
select template, status, error, created_at from public.email_log order by created_at desc limit 20;
```

`sent` means Resend accepted it (check spam, and Resend's own dashboard for delivery). `skipped` means a setting from step 3 is missing. `failed` shows the reason in the `error` column, for example the sending domain is not verified yet.

## Good to know

Receipts are only sent for orders confirmed after you switch email on. Older orders do not get one.
The log holds no email addresses and no keys.
Everything typed by artists or by people filing reports is escaped before it goes into an email.
Not included yet: artist approval notices, follower alerts, and marketing email.
