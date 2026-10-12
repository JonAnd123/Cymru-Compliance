# Cymru Compliance — portal & backend

The portal (`/portal/app.html`) is a static app that talks to **Supabase** (Postgres + login + file storage).
There is no server of your own to run. With no configuration it runs in **demo mode** on sample data.

## What's built (PRD Phases 1–2)

| Area | Who | What |
|---|---|---|
| Dashboard | all practice roles | RAG score, 6-month trend, category donut, expiry chart, drill-down, "vs group average" |
| Evidence portal | Principal, Practice Manager | upload by category, expiry dates, verify/reject, version history |
| My records & training | Staff, PM, Principal | own certificates; induction/refresher/PM modules with progress |
| Team training | Principal, PM | assign modules, track completion (feeds dashboard) |
| Compliance check | Principal, PM | 24-question self-assessment, autosave, gap report (print/PDF) |
| Group overview | Group Admin | roll-up score, status mix, ranked "needs attention", benchmarking, billing mode |
| Practices | Group Admin | add/remove practices, invite Principals |
| Bookings | Principal, PM, Group Admin, admin | pre-inspection visits & PM training, **bulk booking across sites**; admin confirms/completes and attaches the gap report |
| Inspector access | Principal → Inspector | time-boxed read-only grants, auto-expiry, revoke, view-log |
| Inspection view | Inspector | read-only, organised by HIW category; every file opened is logged |
| Audit log | Principal, PM, Group Admin, admin | who viewed/changed what; cannot be edited or deleted; CSV export |
| Admin | you (platform admin) | invite/edit/deactivate users, groups & practices, website enquiries |
| Security | all | invitation-only sign-up, TOTP two-factor, English/Welsh |

Roles: `platform_admin`, `group_admin`, `principal`, `practice_manager`, `staff`, `inspector`.
Access is **invitation-only**: the database rejects sign-ups for emails that haven't been invited.

## Go live (about 20 minutes, free)

1. Create a free account at supabase.com → **New project**. **Region: London (eu-west-2)** for UK data residency.
2. **SQL Editor** → paste and run `supabase/01_schema.sql`, then `supabase/02_seed.sql`.
   Before running 01, change the last line's email if the admin email isn't `jonathan.milton.anderson@gmail.com`.
3. **Project Settings → API**: copy the *Project URL* and the *anon public* key into `js/site-config.js`.
   Never use the `service_role` key anywhere in this site.
4. **Authentication → URL Configuration**: set *Site URL* to your live site, and add `<your-site>/portal/app.html` to Redirect URLs.
5. Re-upload the site to GitHub Pages. Open `/portal/app.html` → **Create account** with your admin email.
   You are now platform admin: use **Users & invites** to create groups, practices and invite everyone else.
6. Optional: **Authentication → Providers → Email**: set minimum password length 10 and leave "Confirm email" on.

Website enquiries (demo / interest / waitlist forms) are saved to the `enquiries` table once step 3 is done; you read them in **Enquiries**. Without it they fall back to opening the visitor's email client.

## Things to know

- **Free-tier limits** (third-party summaries; confirm on [supabase.com/pricing](https://supabase.com/pricing)): 500 MB database, 1 GB files, 50,000 monthly users, two free projects.
  **Free projects pause after about a week of inactivity** and are offline until restored from the dashboard — fine for testing, not for real practices. Pro is about $25/month.
  Sources: [JetAdmin](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/), [Makerkit](https://makerkit.dev/blog/saas/supabase-pricing), [CostBench](https://costbench.com/software/database-as-service/supabase/free-plan/).
- **Do not load real patient/staff data on the free plan yet.** Staff DBS/ID documents are sensitive personal data (UK GDPR). Before real use: Pro plan, a DPA with Supabase, privacy policy and terms, and a data-protection review.
- **Invitation emails:** the app does not email invites; the invitee goes to the portal and creates an account with the invited address. Supabase's built-in email sender is heavily rate-limited — add your own SMTP (Resend, Brevo etc.) under Authentication → SMTP for confirmation and reset emails.
- **Scores are calculated in the browser** from de-identified data the database supplies. That is fine for an MVP but a Principal could tamper with their own practice's stored trend snapshot. Hardening step: move scoring into a database function.
- **Two-factor is available, not enforced.** Principals and Group Admins see a prompt. Enforcing it means requiring `aal2` in the RLS helpers.
- **Billing** is only a recorded preference and an illustrative price. There is no payment collection.
- **Content is illustrative.** The 24 self-assessment questions and the training outlines in `02_seed.sql` must be mapped to HIW's actual framework by a dental compliance expert, and training needs real learning content. Welsh has not been proofread by a native speaker.
- **Deleting evidence is deliberately not possible** from the app (audit trail). Remove files from the Supabase dashboard if legally required.

## How it was tested

- `supabase/tests/rls_test.py` — 76 checks run against a real PostgreSQL server: invitation gating, every role's read/write limits, group isolation, inspector grant expiry/revocation, audit immutability. (Run it by stubbing Supabase's `auth`/`storage` schemas, see `stubs.sql`.)
- `portal/tests/smoke.js` — 240 checks in a simulated browser: every role × every page in English and Welsh, plus real flows (assessment → gap report, verify, invite, grant, book, bulk book, permission denials).
- The live Supabase connection itself (auth emails, storage uploads, PostgREST) could not be exercised from the build environment. Do a first-run pass yourself: sign up, upload a file, invite a Principal, sign in as them.

## Folder map

```
supabase/01_schema.sql   tables, security rules (RLS), storage policies, RPCs
supabase/02_seed.sql     self-assessment questions, training modules (EN/CY)
supabase/tests/          database permission tests
portal/app.html          the portal
portal/js/api-supabase.js  live data layer        portal/js/api-demo.js  demo data layer
portal/js/views-*.js     screens                  portal/js/i18n.js      Welsh strings
js/site-config.js        <- paste Supabase URL + anon key here
```

## White-label version (Practice Plan)

`portal/practiceplan.html` is the same portal re-skinned; `portal/app.html` is unchanged. Same code and same Supabase project, so features stay in step.
- Colours: edit the variables at the top of `portal/css/theme-practiceplan.css` (currently placeholders).
- Logo: save it as `portal/brand/practiceplan-logo.png`. Until it exists the name shows as text.
- Name/logo wording: the `window.CC_BRAND` line in `practiceplan.html`.
- To make another white-label copy, duplicate `practiceplan.html` and the theme CSS and change those three things.
