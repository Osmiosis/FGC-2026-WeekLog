> **SUPERSEDED (2026-07-09):** Supabase auth was removed. The app now uses Better
> Auth + Google OAuth. See `docs/better-auth-google-setup.md`. Kept for history only.

# Custom SMTP for Supabase Auth — Setup Checklist (Resend)

**Why:** The default Supabase mailer (`noreply@mail.app.supabase.io`) has no SPF/DKIM
alignment with your domain, so magic-link emails to external Gmail users get spam-filed
or silently dropped. Auth logs confirmed: `/otp` returns `200 error:null` but mail never
lands. Custom SMTP with a verified domain fixes delivery **and** gives real delivery logs.

**Scope:** Dashboard + DNS only. No repo code changes — `AuthProvider.signInWithOtp` and
the worker auth are already correct.

---

## Prerequisite — a domain you control

Resend sends to arbitrary recipients **only** from a domain you've verified via DNS.
The free `onboarding@resend.dev` sender delivers to your account email only — not usable.

- ✅ Have a domain (e.g. `teamqatar.qa`) with DNS access → proceed.
- ❌ No domain → buy one first (Cloudflare Registrar / Namecheap, ~$10/yr), or pick another
  SMTP provider that suits what you have. Everything below assumes Resend + your domain.

---

## Step 1 — Resend account + domain verification

1. Sign up at https://resend.com (free tier: 3,000 emails/mo, 100/day — ample for magic links).
2. **Domains → Add Domain** → enter your domain (e.g. `teamqatar.qa`).
3. Resend shows DNS records. Add them at your DNS provider (Cloudflare, etc.).
   Set Cloudflare proxy to **DNS only (grey cloud)** for these:

   | Type | Name (host)                  | Value                                   | Notes            |
   |------|------------------------------|-----------------------------------------|------------------|
   | MX   | `send.teamqatar.qa`          | `feedback-smtp.us-east-1.amazonses.com` | priority **10**  |
   | TXT  | `send.teamqatar.qa`          | `v=spf1 include:amazonses.com ~all`     | SPF              |
   | TXT  | `resend._domainkey.teamqatar.qa` | (long DKIM value Resend gives you)  | DKIM — copy exact|

   *(Exact names/region come from Resend's screen — use those, the above is the shape.)*

4. Recommended DMARC (helps Gmail trust you):

   | Type | Name                    | Value                                          |
   |------|-------------------------|------------------------------------------------|
   | TXT  | `_dmarc.teamqatar.qa`   | `v=DMARC1; p=none; rua=mailto:you@teamqatar.qa`|

5. Back in Resend → **Verify**. Propagation is usually minutes, can take up to ~1 hr.
   Wait for all records **Verified ✅** before continuing.

## Step 2 — Resend SMTP credentials

1. Resend → **API Keys → Create API Key** (name: `supabase-smtp`, permission: Sending).
2. Copy the key (`re_...`) — shown once. This is your SMTP **password**.
3. SMTP connection values:
   - Host: `smtp.resend.com`
   - Port: `465` (SSL) — or `587` if 465 is blocked
   - Username: `resend`
   - Password: the `re_...` API key

## Step 3 — Configure Supabase

Dashboard → **Authentication → Emails → SMTP Settings** (a.k.a. Project Settings → Auth → SMTP):

1. Toggle **Enable Custom SMTP** on.
2. Fill in:
   - **Sender email:** `noreply@teamqatar.qa`  ← must be on the verified domain
   - **Sender name:** `Team Qatar Logbook`
   - **Host:** `smtp.resend.com`
   - **Port:** `465`
   - **Username:** `resend`
   - **Password:** `re_...` (the API key)
3. Save.

## Step 4 — Raise the email rate limit

Dashboard → **Authentication → Rate Limits**:

- **Rate limit for sending emails:** default is ~2/hour (the thing that throttled everyone).
  Raise to e.g. **30–50/hour** (stay under Resend's 100/day free cap).

## Step 5 — Verify it works

1. From the **live app** (`https://weeklog.pages.dev`), request a magic link for a test
   address that is **not** your admin email (use a fresh Gmail, not `vibha.aarav@gmail.com`).
2. Confirm the email arrives in **Inbox** (not Spam).
3. Click it → lands back on the app, signed in.
4. Cross-check in **Resend → Emails**: you should see a `Delivered` event.
5. Cross-check in **Supabase → Logs → Auth Logs**: the `/otp` row now shows populated
   `mail_to` / `mail_from` (was `null` before).

## Step 6 — Tell existing affected users

The links you sent before this fix are likely sitting in their **Spam/Junk** and will
still work until they expire. Ask them to check there, or just re-request a link now that
delivery is fixed.

---

## Notes

- **No code change needed.** `emailRedirectTo: window.location.origin` already resolves to
  your prod origin. Just confirm that origin is in Supabase → **Auth → URL Configuration →
  Redirect URLs** (add `https://weeklog.pages.dev/**` if not present) or post-click redirect 404s.
- **Admin gate is separate:** non-admin users who now receive links can sign in
  (`requireUser`) but every `requireAdmin` route returns 403 — that's the single-admin design
  (`ADMIN_EMAIL = vibha.aarav@gmail.com`). If others need write access, that's a separate change.
- **Alt providers** (same shape, different host/creds): SendGrid (`smtp.sendgrid.net:587`),
  AWS SES, Postmark, Mailgun. Resend chosen for the simplest free tier + domain flow.
