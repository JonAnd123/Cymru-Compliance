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
| HR (site) | Principal, Practice Manager | staff directory with photos, leave requests and approval, calendar, absence (sickness, Bradford factor), documents, notes, GDC/indemnity/DBS expiry alerts |
| My HR | Staff, PM, Principal | own record, leave balance, request leave, who's off |
| Group HR | Group Admin | read-only roll-up across sites (staffing, off today, absence rate, expiries) and full record detail, every view audited |
| Security | all | invitation-only sign-up, TOTP two-factor, English/Welsh |

Roles: `platform_admin`, `group_admin`, `principal`, `practice_manager`, `staff`, `inspector`.
Access is **invitation-only**: the database rejects sign-ups for emails that haven't been invited.

## Go live (about 20 minutes, free)

1. Create a free account at supabase.com → **New project**. **Region: London (eu-west-2)** for UK data residency.
2. **SQL Editor** → paste and run `supabase/01_schema.sql`, then `supabase/02_seed.sql`, then `03_hr.sql` (HR module), then `05_alerts_grouptraining.sql` (alerts + group training guard), then `06_compliance_tools.sql` (tasks, maintenance, logs, policies, staff checklists, extra audits). On a project you set up earlier, run `03`, `04_hiw_questions.sql` (replaces the old 24 sample questions with the HIW set — it deletes answers given to the old ones) `05` and `06`. A fresh project does not need 04, because `02_seed.sql` already contains the new questions.
   Before running 01, change the last line's email if the admin email isn't `jonathan.milton.anderson@gmail.com`.
3. **Project Settings → API**: copy the *Project URL* and the *anon public* key into `js/site-config.js`.
   Never use the `service_role` key anywhere in this site.
4. **Authentication → URL Configuration**: set *Site URL* to your live site, and add `<your-site>/portal/app.html` to Redirect URLs.
5. Re-upload the site to GitHub Pages. Open `/portal/app.html` → **Create account** with your admin email.
   You are now platform admin: use **Users & invites** to create groups, practices and invite everyone else.
6. Optional: **Authentication → Providers → Email**: set minimum password length 10 and leave "Confirm email" on.

Website enquiries (demo / interest / waitlist forms) are saved to the `enquiries` table once step 3 is done; you read them in **Enquiries**. Without it they fall back to opening the visitor's email client.

## HR module notes

- **Staff are matched to their login by email.** Add a staff record with the same email the person signs in with and they automatically see their own leave under *My HR*.
- **Who sees what:** managers (Principal / Practice Manager) of the site: everything. Group Admin: everything for their group's sites, **read-only**, and each record opened is written to the audit log. Staff: their own record and leave only; colleagues see only *names and dates* of who is off, never the type (so sickness/maternity stay private). Inspectors: none.
- **Leave rules built in:** weekends and England/Wales bank holidays are not counted (list in `portal/js/hr-core.js`, update each year); half days; overlap check; staff cannot request more annual leave than remains; family leave (maternity, paternity, adoption, shared parental) is recorded by the manager.
- **Sensitive data:** sickness, maternity and HR notes are health/special-category data under UK GDPR. Before real use you will need a privacy notice for staff, a lawful basis and retention policy, and (given the sensitivity) a short DPIA. HR notes are insert-only (they cannot be edited later); documents can be deleted by managers.
- **Files:** photos and documents live in a private `hr` storage bucket, path `<practice>/<staff>/<file>`, 10 MB limit; photos are resized in the browser to 480 px.
- **Not included:** payroll, rotas/shift planning, part-time pro-rata of bank holidays, carry-over of unused leave, public holiday rules for Scotland/NI.

## Group training, alerts and reminder e-mails

- **Group training** (Group Admin → *Group training*): assign modules to everyone (by role) in chosen group practices in one go, then track a practice × module completion matrix and an overdue list. Database rule: the assignee must be an active member of the practice, and a Group Admin can only assign inside their own group.
- **Alerts** (bell + *Alerts* page): expired items and anything expiring within 60 days — evidence, GDC registration, indemnity and DBS (from HR records), overdue training (due within 14 days or late) and the next HIW inspection (within 30 days). Principals/Practice Managers see their practice, Group Admins every group practice, staff only their own evidence and training.
- **Reminder e-mails** (live version only): a GitHub Action (`.github/workflows/alert-digest.yml`, weekdays 07:30 UTC) calls the service-role-only SQL function `alerts_due()`, e-mails each person one digest through [Resend](https://resend.com), then records what was sent in `alert_log` so nothing repeats. Reminders go out at 60, 30, 14 and 0 days and once expired. Setup: copy `.github/` and `scripts/` into the root of your repo; add repository secrets `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (the **service role** key — never put it in the website), `RESEND_API_KEY`, `MAIL_FROM` (a sender on a domain verified in Resend) and optionally `PORTAL_URL`; run the workflow once manually with *dry run* on. Users can opt out on the Alerts page. Group Admins get in-app alerts only, not e-mails (for now).

## Tasks, maintenance, logs, policies, staff compliance and audits (`06_compliance_tools.sql`)

- **Tasks & calendar:** recurring tasks (daily to every five years) with an owner. *Mark done* records who and when and sets the next due date. A month calendar shows tasks, completions, approved leave and the HIW inspection date. *Add recommended tasks* loads a starter set. Group Admins can create tasks across their group.
- **Maintenance register:** services, tests, insurance and certificates. Enter *last done* and the database works out *next due* (14-month autoclave and 26-month compressor intervals are included as starting values). Managers edit; Group Admins read.
- **Logs:** autoclave, washer-disinfector, emergency drugs/oxygen/defibrillator, fridge, legionella temperature and X-ray. Any staff member can add an entry; it is signed with their name and cannot be edited or deleted. Out-of-range or unticked entries are flagged "Action needed" and require a note.
- **Policies:** 15 template policies (English; Welsh titles). Each person reads and confirms; managers see how many of the team have signed. They are templates, not legal advice.
- **Staff compliance:** per-person training percentage (21 courses with default validity periods, shown as a matrix), recruitment paperwork percentage (14 items; GDC, DBS, indemnity and emergency contact tick automatically from the HR record) and policy sign-off percentage, rolled into an overall figure. Group Admins read.
- **Audits:** infection prevention & control, clinical record keeping, antibiotic prescribing, patient survey and disability access. They use the same question engine as the HIW self-assessment but do **not** change the HIW score.
- **Alerts and dashboard:** overdue tasks and maintenance now appear in the bell, the Alerts page and the e-mail digest (daily and weekly tasks are in-app only), and the dashboard shows task, policy, staff-compliance and maintenance tiles.
- Content lives in `portal/js/tools-content.js` and `portal/js/audit-content.js`; `supabase/tools/build_06.py` regenerates `06_compliance_tools.sql` from them (`python3 supabase/tools/build_06.py`). Audit questions, task and maintenance intervals, course validity periods and policy text are starting points for a dental compliance expert to review. Welsh is not proofread.

## Things to know

- **Free-tier limits** (third-party summaries; confirm on [supabase.com/pricing](https://supabase.com/pricing)): 500 MB database, 1 GB files, 50,000 monthly users, two free projects.
  **Free projects pause after about a week of inactivity** and are offline until restored from the dashboard — fine for testing, not for real practices. Pro is about $25/month.
  Sources: [JetAdmin](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/), [Makerkit](https://makerkit.dev/blog/saas/supabase-pricing), [CostBench](https://costbench.com/software/database-as-service/supabase/free-plan/).
- **Do not load real patient/staff data on the free plan yet.** Staff DBS/ID documents are sensitive personal data (UK GDPR). Before real use: Pro plan, a DPA with Supabase, privacy policy and terms, and a data-protection review.
- **Invitation emails:** the app does not email invites; the invitee goes to the portal and creates an account with the invited address. Supabase's built-in email sender is heavily rate-limited — add your own SMTP (Resend, Brevo etc.) under Authentication → SMTP for confirmation and reset emails.
- **Scores are calculated in the browser** from de-identified data the database supplies. That is fine for an MVP but a Principal could tamper with their own practice's stored trend snapshot. Hardening step: move scoring into a database function.
- **Two-factor is available, not enforced.** Principals and Group Admins see a prompt. Enforcing it means requiring `aal2` in the RLS helpers.
- **Billing** is only a recorded preference and an illustrative price. There is no payment collection.
- **Questions are derived, not official.** The 74 self-assessment questions come from the HIW dental inspection workbook (Findings and Recommendations) and keep the six scoring categories. Each has an 'evidence' hint. A dental compliance expert should confirm them against HIW's current framework and the Private Dentistry (Wales) Regulations (e.g. WHTM 01-05 intervals, IR(ME)R wording). Training outlines are still illustrative and need real learning content. Welsh has not been proofread by a native speaker (and the evidence hints are English only).
- **Deleting evidence is deliberately not possible** from the app (audit trail). Remove files from the Supabase dashboard if legally required.

## How it was tested

- `supabase/tests/rls_test.py` — 196 checks (includes tasks, maintenance, logs, policies, checklists, audit kinds, group training and alert rules, plus the HR rules: staff isolation, group admin read-only, leave approval guards, who's-off privacy, HR file access) run against a real PostgreSQL server: invitation gating, every role's read/write limits, group isolation, inspector grant expiry/revocation, audit immutability. (Run it by stubbing Supabase's `auth`/`storage` schemas, see `stubs.sql`.)
- `portal/tests/smoke.js` — 524 checks in a simulated browser: every role × every page in English and Welsh, plus real flows (assessment → gap report, verify, invite, grant, book, bulk book, permission denials).
- The live Supabase connection itself (auth emails, storage uploads, PostgREST) could not be exercised from the build environment. Do a first-run pass yourself: sign up, upload a file, invite a Principal, sign in as them.

## Folder map

```
supabase/01_schema.sql   tables, security rules (RLS), storage policies, RPCs
supabase/02_seed.sql     self-assessment questions, training modules (EN/CY)
supabase/03_hr.sql       HR module: staff, leave, documents, notes, who's-off, hr storage bucket
supabase/04_hiw_questions.sql  upgrade: HIW-workbook question set
supabase/06_compliance_tools.sql  tasks, maintenance, logs, policies, checklists, audit kinds (generated)
supabase/05_alerts_grouptraining.sql  alert prefs/log, alerts_due(), assignment guard
scripts/send-alert-digests.mjs  e-mail reminder job (run by .github/workflows/alert-digest.yml)
supabase/tests/          database permission tests
portal/app.html          the portal
portal/js/api-supabase.js  live data layer        portal/js/api-demo.js  demo data layer
portal/js/views-*.js     screens (views-hr.js = HR)                  portal/js/i18n.js      Welsh strings
js/site-config.js        <- paste Supabase URL + anon key here
```

## White-label version (Practice Plan)

`portal/practiceplan.html` is the same portal re-skinned; `portal/app.html` is unchanged. Same code and same Supabase project, so features stay in step.
- Colours: edit the variables at the top of `portal/css/theme-practiceplan.css` (currently placeholders).
- Logo: save it as `portal/brand/practiceplan-logo.png`. Until it exists the name shows as text.
- Name/logo wording: the `window.CC_BRAND` line in `practiceplan.html`.
- To make another white-label copy, duplicate `practiceplan.html` and the theme CSS and change those three things.
