# Integration options: Dentally, SOE (EXACT), Kodak / Carestream

Research notes, October 2026. Public information only; none of these integrations has been built or tested. Confirm every access route directly with the vendor.

## What each system can realistically give us

| Data | Why it helps Cymru Compliance | Sensible source |
|---|---|---|
| Staff & clinician list (names, roles, GDC numbers) | Pre-fills HR records and training assignments; keeps the team list current | Practice-management system (PMS) |
| X-ray units, sensors, image counts, rejects | Evidence for radiation file; image-quality (grade 1/2/3) audits (HIW workbook X5) | Imaging software (Kodak/Carestream, Examine Pro) |
| Aggregated clinical-record completeness (medical history updated, BPE recorded, consent noted, recall set) | Automates the "5 records per clinician" audit (R10) | PMS, but see data-protection note |
| Equipment/maintenance dates | Autoclave, compressor, X-ray test dates → expiry alerts | Mostly NOT in a PMS; keep in Cymru Compliance |

**Data-protection note:** patient records are special-category data. The safest design reads only aggregate counts (e.g. "38 of 40 sampled records have a signed medical history"), never patient identifiers, and runs a DPIA with each practice first. Do not copy patient-level data into Supabase.

## Dentally

- Has a public API reference for its new **NexGen API** (OpenAPI 3.0, bearer-token auth, moving to OAuth2). Today the public docs show only a few resource groups (Sites; Patients for early experimentation) and say production URLs are issued when integrations go live. Source: [Dentally NexGen API docs](https://docs.api.dentally.com/).
- Access is gated: Dentally's [partner API FAQ](https://help.dentally.com/en/articles/15956843-dentally-partner-api-faq-s) says non-partners apply online and must pass an account review; the Partnerships team then gives documentation and sandbox access; going to production needs a recorded sandbox demo. Older v1 integrations must eventually migrate to NexGen.
- Dentally runs an [approved integration-partner programme](https://www.dentally.com/en-ie/partners) (visibility to practices).
- **Fit:** best of the three technically. Plausible first features: sync users/clinicians (names, GDC numbers) into HR; record-completeness statistics if NexGen exposes clinical notes. Unknown until we see the sandbox: whether staff/user and clinical-note endpoints exist.

## SOE (Software of Excellence) — EXACT

- EXACT is Henry Schein One's UK PMS. I found **no public EXACT developer portal or integrator list**. The known integrations are commercial partnerships (e.g. [Pearl AI, announced June 2024](https://dentistry.co.uk/2024/06/09/software-of-excellence-announces-partnership-with-pearl/); a planned AI-scribe link described by [Tandem](https://tandemhealth.ai/product/integrations/exact)). Henry Schein One's [API Exchange](https://www.henryscheinone.com/dental-solutions/api-exchange/api-exchange-vendors/) pages cover Dentrix, not EXACT.
- **Fit:** needs a conversation with Software of Excellence / Henry Schein One UK. Until then, offer a practice-run CSV export (staff list, appointment/clinician report) that the portal imports, or have the practice share reports.

## Kodak / Carestream Dental

- The Kodak dental business is now **Carestream Dental**. I could not confirm in public sources whether any "Kodak" brand is still used for current UK software, so check with the practice what they actually run. UK products: CS R4+ (on-premise PMS) and Sensei Cloud.
- Sensei Cloud lists an open API and HL7 in its [G-Cloud entry](https://www.applytosupply.digitalmarketplace.service.gov.uk/g-cloud/services/713936219092976); the Sensei Developer Program is request-gated. For R4+, no open third-party API was found; integrations are via Carestream's Authorized Partner programme. Imaging (e.g. image quality, sensor lists) would come from the imaging software rather than the PMS.
- **Fit:** weakest for automation. Realistic start: manual upload of sensor/unit lists and QA audit results as evidence.

## Suggested order

1. **No-integration win now:** CSV import of staff (name, role, GDC number, start date) into HR, from any PMS export.
2. **Dentally pilot:** apply for NexGen sandbox access; build staff sync first, record-completeness stats second.
3. **SOE and Carestream:** open vendor conversations in parallel; both are partner-programme routes (expect NDAs, security review and fees).
4. Do a DPIA and get practice sign-off before reading any clinical data.
