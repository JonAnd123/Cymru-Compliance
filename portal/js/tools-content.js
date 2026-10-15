/* Shared content for tasks, maintenance register, digital logs, policy library, training/recruitment matrices.
   Single source: the demo data layer uses it directly and supabase/06_compliance_tools.sql is generated from it
   (see supabase/tools/build_06.py). Templates are starting points: have a dental compliance expert review them.
   Welsh text is best-effort and not proofread. */
window.CC = window.CC || {};
(function () {
  var T = {};

  /* ---------- frequencies (key, English label, months, days) ---------- */
  T.FREQ = [
    ["once", "Just once", 0, 0], ["daily", "Every day", 0, 1], ["weekly", "Every week", 0, 7], ["fortnightly", "Every two weeks", 0, 14],
    ["four_weekly", "Every four weeks", 0, 28], ["monthly", "Every month", 1, 0], ["quarterly", "Every three months", 3, 0],
    ["six_monthly", "Every six months", 6, 0], ["yearly", "Every year", 12, 0], ["fourteen_months", "Every 14 months", 14, 0],
    ["two_yearly", "Every two years", 24, 0], ["twenty_six_months", "Every 26 months", 26, 0], ["three_yearly", "Every three years", 36, 0],
    ["five_yearly", "Every five years", 60, 0]
  ];
  var FREQ = {}; T.FREQ.forEach(function (f) { FREQ[f[0]] = f; });
  T.freqLabel = function (k) { return FREQ[k] ? FREQ[k][1] : k; };
  // next date after iso date d for frequency k (month arithmetic clamps to month end, like Postgres)
  T.nextDue = function (k, d) {
    var f = FREQ[k]; if (!f || (!f[2] && !f[3]) || !d) return null;
    var p = String(d).slice(0, 10).split("-").map(Number), y = p[0], m = p[1] - 1, day = p[2];
    if (f[3]) { var dt = new Date(Date.UTC(y, m, day + f[3])); return dt.toISOString().slice(0, 10); }
    var tm = m + f[2], ny = y + Math.floor(tm / 12), nm = ((tm % 12) + 12) % 12, last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
    return new Date(Date.UTC(ny, nm, Math.min(day, last))).toISOString().slice(0, 10);
  };

  /* ---------- recommended recurring tasks (title, category, frequency, title_cy) ---------- */
  T.TASK_LIBRARY = [
    ["Medical emergency drugs, oxygen & defibrillator check", "Health & safety", "weekly", "Gwiriad cyffuriau brys, ocsigen a diffibriliwr"],
    ["Smoke alarm & emergency light check", "Fire", "weekly", "Gwiriad larwm mwg a goleuadau argyfwng"],
    ["Infection control: surgery & decontamination log book checks", "Infection control", "weekly", "Rheoli heintiau: gwirio llyfrau log meddygfeydd a diheintio"],
    ["Legionella water temperature checks", "Health & safety", "monthly", "Gwiriadau tymheredd dŵr legionella"],
    ["Practice team meeting", "Governance", "monthly", "Cyfarfod tîm y practis"],
    ["Review complaints, significant events & MHRA alerts", "Governance", "monthly", "Adolygu cwynion, digwyddiadau arwyddocaol a rhybuddion MHRA"],
    ["Review CPD and training matrix", "Staff", "quarterly", "Adolygu DPP a'r matrics hyfforddi"],
    ["Fire drill", "Fire", "six_monthly", "Ymarfer tân"],
    ["Infection prevention & control audit", "Audits", "six_monthly", "Archwiliad atal a rheoli heintiau"],
    ["Antibiotic prescribing audit", "Audits", "six_monthly", "Archwiliad presgripsiynu gwrthfiotigau"],
    ["Clinical record keeping audit", "Audits", "yearly", "Archwiliad cadw cofnodion clinigol"],
    ["Patient survey audit", "Audits", "yearly", "Archwiliad arolwg cleifion"],
    ["Disability access audit", "Audits", "yearly", "Archwiliad mynediad anabledd"],
    ["Staff appraisals", "Staff", "yearly", "Arfarniadau staff"],
    ["Review GDC registration certificates", "Staff", "yearly", "Adolygu tystysgrifau cofrestru GDC"],
    ["Review policies", "Governance", "yearly", "Adolygu polisïau"],
    ["Review radiation protection file and local rules", "Radiation", "yearly", "Adolygu'r ffeil diogelu rhag ymbelydredd a'r rheolau lleol"]
  ];

  /* ---------- recommended maintenance register (group, item, frequency, item_cy) ---------- */
  T.MAINT_LIBRARY = [
    ["General", "ICO registration", "yearly", "Cofrestriad ICO"],
    ["General", "Employers' liability insurance", "yearly", "Yswiriant atebolrwydd cyflogwr"],
    ["General", "Public liability insurance", "yearly", "Yswiriant atebolrwydd cyhoeddus"],
    ["General", "External legionella risk assessment", "two_yearly", "Asesiad risg legionella allanol"],
    ["Electrical", "Fixed wire testing", "five_yearly", "Profi gwifrau sefydlog"],
    ["Electrical", "Portable appliance (PAT) testing", "yearly", "Profi offer cludadwy (PAT)"],
    ["Fire", "Fire risk assessment", "yearly", "Asesiad risg tân"],
    ["Fire", "Emergency lighting service", "yearly", "Gwasanaethu goleuadau argyfwng"],
    ["Fire", "Fire extinguisher service", "yearly", "Gwasanaethu diffoddwyr tân"],
    ["Fire", "Fire alarm system service", "yearly", "Gwasanaethu system larwm tân"],
    ["Gas & air", "Gas safety check", "yearly", "Gwiriad diogelwch nwy"],
    ["Gas & air", "Air conditioning service", "yearly", "Gwasanaethu aerdymheru"],
    ["Gas & air", "Oxygen cylinder service", "yearly", "Gwasanaethu silindr ocsigen"],
    ["Decontamination", "Autoclave 1 inspection & validation", "fourteen_months", "Archwilio a dilysu awtoclaf 1"],
    ["Decontamination", "Autoclave 2 inspection & validation", "fourteen_months", "Archwilio a dilysu awtoclaf 2"],
    ["Decontamination", "Washer-disinfector service & validation", "yearly", "Gwasanaethu a dilysu'r golchwr-diheintydd"],
    ["Pressure vessels", "Compressor / pressure vessel inspection", "twenty_six_months", "Archwilio cywasgydd / llestri gwasgedd"],
    ["Radiation", "X-ray equipment critical examination & routine test", "three_yearly", "Archwiliad critigol a phrawf arferol offer pelydr-X"],
    ["Radiation", "Automatic X-ray processor service", "yearly", "Gwasanaethu prosesydd pelydr-X awtomatig"],
    ["Waste", "Amalgam separator service", "yearly", "Gwasanaethu gwahanydd amalgam"],
    ["Waste", "Waste contracts review", "yearly", "Adolygu contractau gwastraff"]
  ];

  /* ---------- digital logs ----------
     Each log: key, title, cy, intro, frequency hint, fields. field = {t:"check"|"number"|"select", k, l, cy, min, max, unit, opts} */
  T.LOGS = [
    { key: "autoclave", title: "Autoclave daily log", cy: "Log dyddiol awtoclaf", freq: "Daily", fields: [
      { t: "check", k: "start", l: "Start-of-day checks done (water level, door seal, test cycle)", cy: "Gwiriadau dechrau'r dydd wedi'u gwneud (lefel dŵr, sêl drws, cylchred prawf)" },
      { t: "check", k: "end", l: "End-of-day checks done (water reservoir emptied)", cy: "Gwiriadau diwedd y dydd wedi'u gwneud (cronfa ddŵr wedi'i gwagio)" },
      { t: "check", k: "printout", l: "Cycle printouts / records kept", cy: "Printiadau / cofnodion cylchred wedi'u cadw" },
      { t: "number", k: "cycles", l: "Cycles run today", cy: "Cylchredau heddiw", min: 0, max: 200 }] },
    { key: "washer", title: "Washer-disinfector log", cy: "Log golchwr-diheintydd", freq: "Each working day", fields: [
      { t: "check", k: "daily", l: "Daily test completed and passed", cy: "Prawf dyddiol wedi'i gwblhau a'i basio" },
      { t: "check", k: "chamber", l: "Chamber and filters checked and clean", cy: "Siambr a hidlwyr wedi'u gwirio ac yn lân" },
      { t: "check", k: "cycle", l: "Cycle records show a successful cycle", cy: "Mae cofnodion y gylchred yn dangos cylchred lwyddiannus" },
      { t: "number", k: "cycles", l: "Cycles run today", cy: "Cylchredau heddiw", min: 0, max: 100 }] },
    { key: "emergency", title: "Emergency drugs, oxygen & defibrillator check", cy: "Gwiriad cyffuriau brys, ocsigen a diffibriliwr", freq: "Weekly", fields: [
      { t: "check", k: "drugs", l: "All emergency drugs present and in date", cy: "Pob cyffur brys yn bresennol ac o fewn dyddiad" },
      { t: "check", k: "oxygen", l: "Oxygen cylinder contents adequate (30 minutes' supply minimum)", cy: "Cynnwys silindr ocsigen yn ddigonol (cyflenwad 30 munud o leiaf)" },
      { t: "check", k: "aed", l: "Defibrillator self-test passed, pads in date", cy: "Hunan-brawf diffibriliwr wedi'i basio, padiau o fewn dyddiad" },
      { t: "check", k: "suction", l: "Portable suction working", cy: "Sugnydd cludadwy yn gweithio" },
      { t: "check", k: "kit", l: "Airways, masks, Ambu-bag and first aid kit complete", cy: "Llwybrau anadlu, masgiau, bag Ambu a bocs cymorth cyntaf yn gyflawn" }] },
    { key: "fridge", title: "Fridge temperature log", cy: "Log tymheredd oergell", freq: "Daily", fields: [
      { t: "number", k: "temp", l: "Fridge temperature", cy: "Tymheredd yr oergell", unit: "°C", min: 2, max: 8 },
      { t: "check", k: "reset", l: "Thermometer reset after reading", cy: "Thermomedr wedi'i ailosod ar ôl darllen" }] },
    { key: "legionella", title: "Legionella water temperature log", cy: "Log tymheredd dŵr legionella", freq: "Monthly", fields: [
      { t: "number", k: "hot", l: "Hot water at furthest outlet", cy: "Dŵr poeth wrth yr allfa bellaf", unit: "°C", min: 50, max: 80 },
      { t: "number", k: "cold", l: "Cold water at furthest outlet", cy: "Dŵr oer wrth yr allfa bellaf", unit: "°C", min: 0, max: 20 },
      { t: "check", k: "flush", l: "Little-used outlets flushed", cy: "Allfeydd a ddefnyddir yn anaml wedi'u fflysio" }] },
    { key: "xray", title: "X-ray log", cy: "Log pelydr-X", freq: "Daily or per session", fields: [
      { t: "select", k: "unit", l: "Equipment", cy: "Offer", opts: ["Intra-oral", "Extra-oral / OPG", "CBCT"] },
      { t: "number", k: "taken", l: "Images taken", cy: "Delweddau a gymerwyd", min: 0, max: 500 },
      { t: "number", k: "rejected", l: "Images rejected / repeated", cy: "Delweddau a wrthodwyd / ailadroddwyd", min: 0, max: 50 },
      { t: "check", k: "justified", l: "Every exposure justified and the report recorded in the patient's notes", cy: "Pob datguddiad wedi'i gyfiawnhau a'r adroddiad wedi'i gofnodi yn nodiadau'r claf" }] }
  ];
  T.logDef = function (k) { return T.LOGS.filter(function (l) { return l.key === k; })[0]; };
  // pass = every check ticked and every number inside its limits
  T.logPass = function (def, data) {
    return def.fields.every(function (f) {
      var v = data[f.k];
      if (f.t === "check") return v === true;
      if (f.t === "number") { if (v === undefined || v === null || v === "") return false; v = +v; if (isNaN(v)) return false; return (f.min === undefined || v >= f.min) && (f.max === undefined || v <= f.max); }
      return true;
    });
  };

  /* ---------- training matrix courses (key, title, valid_months, cy) ---------- */
  T.COURSES = [
    ["safeguarding_1", "Safeguarding level 1", 36, "Diogelu lefel 1"], ["safeguarding_2", "Safeguarding level 2", 36, "Diogelu lefel 2"],
    ["safeguarding_3", "Safeguarding level 3", 36, "Diogelu lefel 3"], ["bls", "Medical emergencies / CPR (BLS)", 12, "Argyfyngau meddygol / CPR (BLS)"],
    ["infection_control", "Infection control", 12, "Rheoli heintiau"], ["radiography", "Radiography", 60, "Radiograffeg"],
    ["irmer", "IR(ME)R", 60, "IR(ME)R"], ["cbct", "CBCT", 60, "CBCT"], ["oral_cancer", "Oral cancer", 60, "Canser y geg"],
    ["legal_ethical", "Legal & ethical issues", 60, "Materion cyfreithiol a moesegol"], ["mca_consent", "Mental Capacity Act / consent", 36, "Deddf Galluedd Meddyliol / cydsyniad"],
    ["gdpr", "Data protection / GDPR", 12, "Diogelu data / GDPR"], ["fire_awareness", "Fire awareness", 12, "Ymwybyddiaeth o dân"],
    ["complaints", "Complaints handling", 36, "Ymdrin â chwynion"], ["fire_marshal", "Fire marshal", 36, "Marsial tân"],
    ["first_aider", "First aider", 36, "Swyddog cymorth cyntaf"], ["disability_autism", "Disability & autism awareness", 36, "Ymwybyddiaeth o anabledd ac awtistiaeth"],
    ["sepsis", "Sepsis", 36, "Sepsis"], ["legionella", "Legionella", 36, "Legionella"], ["sedation", "Sedation", 12, "Tawelyddu"],
    ["ils", "Immediate life support", 12, "Cymorth bywyd uniongyrchol"]
  ];
  T.course = function (k) { return T.COURSES.filter(function (c) { return c[0] === k; })[0]; };

  /* ---------- recruitment checklist (key, title, cy, derived-from-HR-field) ---------- */
  T.RECRUIT = [
    ["details", "Staff details / emergency contact", "Manylion staff / cyswllt brys", "emergency_name"],
    ["identity", "Identity ×2 / proof of address", "Hunaniaeth ×2 / prawf cyfeiriad", null],
    ["contract", "Contract / job description / offer letter", "Contract / disgrifiad swydd / llythyr cynnig", null],
    ["induction", "Induction documentation", "Dogfennaeth sefydlu", null],
    ["hep_b", "Hepatitis B / immunisation history", "Hepatitis B / hanes imiwneiddio", null],
    ["dbs", "DBS certificate", "Tystysgrif DBS", "dbs_expiry"],
    ["dbs_risk", "DBS risk assessment", "Asesiad risg DBS", null],
    ["gdc", "GDC registration number & date", "Rhif a dyddiad cofrestru GDC", "gdc_expiry"],
    ["indemnity", "Indemnity certificate", "Tystysgrif indemniad", "indemnity_expiry"],
    ["references", "References ×2", "Geirdaon ×2", null],
    ["appraisals", "Appraisals", "Arfarniadau", null],
    ["pdp", "Personal development plan", "Cynllun datblygu personol", null],
    ["qualifications", "Qualification certificates", "Tystysgrifau cymhwyster", null],
    ["cv", "CV", "CV", null]
  ];

  /* ---------- policy library: templates to adapt (ref, folder, title_en, title_cy, body_en) ---------- */
  T.POLICIES = [
    ["POL01", "Governance", "Complaints policy", "Polisi cwynion",
      "Purpose: to make sure every concern is listened to, recorded and learned from.\nHow it works: patients can complain in person, by phone, in writing or by e-mail, in English or Welsh. We acknowledge a complaint within 2 working days and aim to give a full response within 30 working days, in line with 'Putting Things Right'. Private patients are also given HIW's contact details.\nRecording: every complaint, including verbal and informal concerns, is entered in the complaints log with the action taken.\nLearning: themes are reviewed at the monthly team meeting.\nResponsible person: [name], Registered Manager."],
    ["POL02", "Governance", "Raising concerns (whistleblowing) policy", "Polisi codi pryderon (chwythu'r chwiban)",
      "Purpose: staff are encouraged to raise concerns about patient safety or malpractice without fear of reprisal.\nHow: speak to [name]; if that is not appropriate, speak to the Principal, the GDC, HIW or Protect (the whistleblowing charity).\nThe practice will acknowledge a concern within 5 working days, investigate it fairly and keep the person informed. Staff who raise concerns in good faith will not be disadvantaged."],
    ["POL03", "Safeguarding", "Safeguarding children and adults policy", "Polisi diogelu plant ac oedolion",
      "Purpose: to protect children and adults at risk.\nSafeguarding lead: [name]. All staff complete safeguarding training appropriate to their role and refresh it at least every 3 years.\nIf you have a concern: tell the safeguarding lead the same day, record facts only, and report to the local authority safeguarding team without delay. Never promise to keep a disclosure secret.\nThe Wales Safeguarding Procedures apply."],
    ["POL04", "Infection control", "Infection prevention and control policy", "Polisi atal a rheoli heintiau",
      "Purpose: to reduce the risk of infection to patients and staff.\nStandard precautions: hand hygiene using the practice's 5 moments, PPE for every procedure, safe handling and disposal of sharps, surface cleaning between patients, and dental unit water line management.\nStaff are immunised against Hepatitis B and records are kept.\nAn infection control audit is carried out at least every 6 months and actions are recorded.\nInfection control lead: [name]."],
    ["POL05", "Infection control", "Decontamination policy (WHTM 01-05)", "Polisi diheintio (WHTM 01-05)",
      "Purpose: to make sure reusable instruments are safe to use.\nProcess: transport, clean (washer-disinfector preferred), inspect, sterilise, store and track. Dirty and clean areas are separated.\nRecords: daily and periodic tests of each autoclave and washer-disinfector are logged; equipment is validated and inspected in line with WHTM 01-05 (autoclave inspection at no more than 14-month intervals).\nStaff doing decontamination are trained and training is recorded.\nDecontamination lead: [name]."],
    ["POL06", "Radiation", "Radiation protection policy (IR(ME)R)", "Polisi diogelu rhag ymbelydredd (IR(ME)R)",
      "Purpose: to keep exposures as low as reasonably practicable and comply with IR(ME)R 2017 and the Ionising Radiations Regulations 2017.\nRoles: Legal Person/employer [name]; Radiation Protection Supervisor [name]; Radiation Protection Adviser [name]; HSE notification held.\nEvery exposure must be justified, authorised and recorded. Local rules are displayed at each X-ray unit. Equipment is tested at the required intervals and image quality is audited. Staff holding IR(ME)R duties have documented training."],
    ["POL07", "Health & safety", "Medical emergencies and resuscitation policy", "Polisi argyfyngau meddygol ac adfywio",
      "Purpose: to make sure the team can respond to a medical emergency.\nAll staff complete CPR/basic life support training every year, including anaphylaxis. A named first aider is on duty during opening hours.\nEmergency drugs, oxygen (30 minutes' supply minimum), suction and an AED are checked weekly and the checks are logged. Expired items are replaced.\nIn an emergency call 999, start CPR and fetch the AED."],
    ["POL08", "Health & safety", "Health, safety and fire policy", "Polisi iechyd, diogelwch a thân",
      "Purpose: to provide a safe place to work and be treated.\nWe carry out and review risk assessments (including COSHH, manual handling, display screen equipment and workplace risk), keep an accident book (RIDDOR reportable events are reported to HSE), and keep PPE available.\nFire: a fire risk assessment is in place, alarms and emergency lighting are tested weekly, extinguishers are serviced yearly and drills take place at least every 6 months.\nHealth and safety lead: [name]."],
    ["POL09", "Information governance", "Data protection and confidentiality policy", "Polisi diogelu data a chyfrinachedd",
      "Purpose: to protect patient and staff personal data (UK GDPR, Data Protection Act 2018).\nWe collect only what we need, keep records secure (locked storage, passwords, off-site backup), share information only where permitted, and keep records for the retention periods in the NHS Records Management Code.\nPatients can request their records; we respond within one month. Breaches are reported to [name] immediately and to the ICO within 72 hours where required.\nData protection lead: [name]. ICO registration is renewed every year."],
    ["POL10", "Clinical", "Consent and mental capacity policy", "Polisi cydsyniad a galluedd meddyliol",
      "Purpose: to make sure treatment is only given with valid consent.\nPatients are told the risks, benefits and alternatives (including no treatment) in a way they can understand and are given time to decide. Consent is recorded in the clinical notes. Capacity is assumed unless shown otherwise; where capacity is lacking, the Mental Capacity Act best-interests process is followed and recorded."],
    ["POL11", "Governance", "Equality, diversity and Welsh language (Active Offer) policy", "Polisi cydraddoldeb, amrywiaeth a'r Gymraeg (Cynnig Rhagweithiol)",
      "Purpose: to treat everyone with dignity and fairness and meet the Equality Act 2010.\nWe make reasonable adjustments for disabled patients and staff, provide information in accessible formats, and offer services in Welsh proactively (the 'Active Offer'): patients are not expected to ask. Welsh-speaking staff are identified to patients where possible.\nDiscrimination, harassment or victimisation will not be tolerated."],
    ["POL12", "Health & safety", "Waste management policy", "Polisi rheoli gwastraff",
      "Purpose: to dispose of waste safely and legally.\nWaste is segregated at source into the correct colour-coded containers (clinical, sharps, amalgam, offensive/hygiene, extracted teeth, domestic). Amalgam separators are fitted and serviced. Waste is stored securely until collection by a licensed carrier and consignment notes are kept for the required period. Mercury spillages follow the spill procedure."],
    ["POL13", "Staffing", "Recruitment, DBS and induction policy", "Polisi recruitio, DBS a sefydlu",
      "Purpose: to employ safe, suitable people.\nBefore starting: identity and right-to-work checks, two references, DBS check at the correct level, GDC registration and indemnity for registrants, immunisation history, and a signed contract.\nInduction is completed in the first weeks and signed off by a manager. Appraisals take place every year and personal development plans are kept. Agency staff are checked for competence, training and DBS before they work."],
    ["POL14", "Clinical", "Clinical record keeping policy", "Polisi cadw cofnodion clinigol",
      "Purpose: to keep accurate, complete and contemporaneous records (GDC Standards).\nEvery record shows patient identifiers, reason for attendance, symptoms, updated and signed medical history, examination and charting, BPE with action taken, treatment options and consent, treatment provided, radiograph justification and report, and recall interval. Records are audited at least yearly using a sample from each clinician."],
    ["POL15", "Governance", "Business continuity policy", "Polisi parhad busnes",
      "Purpose: to keep patients safe and the practice running if something goes wrong (power, IT, water, fire, staff shortage).\nKey contacts, alternative arrangements for emergency patients, IT backup and restore steps, and who decides to close are listed in the continuity plan. The plan is tested and reviewed yearly. Continuity lead: [name]."]
  ];

  CC.TOOLS = T;
  if (typeof module !== "undefined" && module.exports) module.exports = T;
})();
