/* Additional audit types (the HIW self-assessment stays in demo-content.js / 02_seed.sql).
   Questions are practical starting sets drawn from the HIW dental inspection workbook and common good practice;
   have a dental compliance expert review them. Welsh not proofread. */
window.CC = window.CC || {};
(function () {
  var A = {};
  A.KINDS = [
    { key: "hiw", title: "HIW self-assessment", cy: "Hunanasesiad AGIC" },
    { key: "ipc", title: "Infection prevention & control audit", cy: "Archwiliad atal a rheoli heintiau" },
    { key: "records", title: "Clinical record keeping audit", cy: "Archwiliad cadw cofnodion clinigol" },
    { key: "antibiotic", title: "Antibiotic prescribing audit", cy: "Archwiliad presgripsiynu gwrthfiotigau" },
    { key: "survey", title: "Patient survey audit", cy: "Archwiliad arolwg cleifion" },
    { key: "disability", title: "Disability access audit", cy: "Archwiliad mynediad anabledd" }
  ];
  // [kind, section, ref, en, cy]
  A.Q = [
    ["ipc", "Hand hygiene & PPE", "I1", "Dedicated hand-washing basins are available in surgeries and the decontamination room, with liquid soap, paper towels and a foot- or elbow-operated tap.", "Mae basnau golchi dwylo pwrpasol ar gael yn y meddygfeydd a'r ystafell ddiheintio, gyda sebon hylif, tywelion papur a thap a weithredir â throed neu benelin."],
    ["ipc", "Hand hygiene & PPE", "I2", "Staff are bare below the elbows and follow hand-hygiene technique at the right moments.", "Mae staff yn foel islaw'r penelinoedd ac yn dilyn techneg hylendid dwylo ar yr adegau cywir."],
    ["ipc", "Hand hygiene & PPE", "I3", "Appropriate PPE (gloves, mask, eye protection, apron) is worn and changed between patients; heavy-duty gloves are used for cleaning instruments.", "Gwisgir offer diogelu personol priodol (menig, mwgwd, diogelwch llygaid, ffedog) a'i newid rhwng cleifion; defnyddir menig trwm i lanhau offerynnau."],
    ["ipc", "Surgery & environment", "I4", "Surgeries are uncluttered, surfaces are sealed and intact, and surfaces are cleaned between every patient.", "Mae'r meddygfeydd yn daclus, arwynebau wedi'u selio ac yn gyfan, a glanheir arwynebau rhwng pob claf."],
    ["ipc", "Surgery & environment", "I5", "A cleaning schedule and cleaning checklists are in use and signed.", "Defnyddir amserlen lanhau a rhestrau gwirio glanhau a'u llofnodi."],
    ["ipc", "Surgery & environment", "I6", "Dental unit water lines are managed (flushing, disinfection, dip-slide or water testing) and recorded.", "Rheolir llinellau dŵr yr uned ddeintyddol (fflysio, diheintio, profi sleid dip neu ddŵr) a'u cofnodi."],
    ["ipc", "Surgery & environment", "I7", "Dental impressions and appliances are cleaned and disinfected before going to and after returning from the laboratory.", "Glanheir a diheintir argraffiadau ac offer deintyddol cyn mynd i'r labordy ac ar ôl dychwelyd."],
    ["ipc", "Sharps & waste", "I8", "Sharps are handled safely (no re-sheathing by hand, wall-mounted bins, bins not overfilled) and a sharps injury procedure is known to all staff.", "Trinnir eitemau miniog yn ddiogel (dim ailwisgo â llaw, biniau ar y wal, biniau heb eu gorlenwi) ac mae pob aelod o staff yn gwybod y drefn anafiadau miniog."],
    ["ipc", "Sharps & waste", "I9", "Waste is segregated into the correct colour-coded containers and stored securely until collection.", "Gwahanir gwastraff i'r cynwysyddion cywir â chod lliw a'i storio'n ddiogel tan ei gasglu."],
    ["ipc", "Decontamination", "I10", "Instrument flow is from dirty to clean with physical separation of decontamination from clinical work.", "Mae llif offerynnau o fudr i lân gyda gwahaniad ffisegol rhwng diheintio a gwaith clinigol."],
    ["ipc", "Decontamination", "I11", "Autoclave and washer-disinfector logs are complete, with daily tests and periodic tests recorded.", "Mae logiau'r awtoclaf a'r golchwr-diheintydd yn gyflawn, gyda phrofion dyddiol a chyfnodol wedi'u cofnodi."],
    ["ipc", "Decontamination", "I12", "Sterilised instruments are stored correctly, dated and used within the specified time.", "Storir offerynnau wedi'u sterileiddio'n gywir, eu dyddio a'u defnyddio o fewn yr amser penodedig."],
    ["ipc", "Staff", "I13", "All staff have in-date infection control training and Hepatitis B immunisation or a documented risk assessment.", "Mae gan bob aelod o staff hyfforddiant rheoli heintiau o fewn dyddiad ac imiwneiddiad Hepatitis B neu asesiad risg wedi'i ddogfennu."],
    ["ipc", "Staff", "I14", "An infection control lead is named, and the last audit's actions have been completed.", "Enwir arweinydd rheoli heintiau, ac mae camau gweithredu'r archwiliad diwethaf wedi'u cwblhau."],

    ["records", "Patient details & history", "C1", "Patient identifiers (name, address, date of birth) are on all notes and inserts.", "Mae dynodwyr y claf (enw, cyfeiriad, dyddiad geni) ar yr holl nodiadau a mewnosodiadau."],
    ["records", "Patient details & history", "C2", "Reason for attendance and symptoms are recorded.", "Cofnodir y rheswm dros fynychu a'r symptomau."],
    ["records", "Patient details & history", "C3", "Initial medical history is signed and dated by the patient and countersigned by the clinician.", "Mae'r hanes meddygol cychwynnol wedi'i lofnodi a'i ddyddio gan y claf a'i wrthlofnodi gan y clinigwr."],
    ["records", "Patient details & history", "C4", "Medical history is updated at each course of treatment and checked verbally at each visit.", "Diweddarir yr hanes meddygol ym mhob cwrs triniaeth ac fe'i gwirir ar lafar ym mhob ymweliad."],
    ["records", "Patient details & history", "C5", "Previous dental history and social history (alcohol, tobacco, smoking cessation advice) are noted.", "Nodir hanes deintyddol blaenorol a hanes cymdeithasol (alcohol, tybaco, cyngor rhoi'r gorau i smygu)."],
    ["records", "Examination & diagnosis", "C6", "Full base charting is present and updated at each course of treatment.", "Mae siartio sylfaenol llawn yn bresennol ac fe'i diweddarir ym mhob cwrs triniaeth."],
    ["records", "Examination & diagnosis", "C7", "Baseline BPE is recorded, acted on (periodontal treatment where indicated) and updated.", "Cofnodir BPE gwaelodlin, gweithredir arno (triniaeth periodontol lle bo angen) a'i ddiweddaru."],
    ["records", "Examination & diagnosis", "C8", "Soft tissue examination (extra- and intra-oral) is recorded and cancer screening is explained.", "Cofnodir archwiliad meinwe meddal (all-geg a mewn-geg) ac eglurir sgrinio canser."],
    ["records", "Treatment & consent", "C9", "Treatment options are noted and a treatment plan is given.", "Nodir opsiynau triniaeth a rhoddir cynllun triniaeth."],
    ["records", "Treatment & consent", "C10", "Informed consent (risks, benefits, alternatives) is recorded.", "Cofnodir cydsyniad gwybodus (risgiau, buddion, dewisiadau eraill)."],
    ["records", "Treatment & consent", "C11", "Treatment provided is recorded fully and a recall interval is set in line with NICE guidance.", "Cofnodir y driniaeth a ddarparwyd yn llawn a gosodir cyfnod galw'n ôl yn unol â chanllawiau NICE."],
    ["records", "Radiographs & referrals", "C12", "Radiographs have justification, a clinical report and a quality grade recorded.", "Mae gan radiograffau gyfiawnhad, adroddiad clinigol a gradd ansawdd wedi'u cofnodi."],
    ["records", "Radiographs & referrals", "C13", "Referrals are appropriate, timely and followed up.", "Mae cyfeiriadau yn briodol, yn amserol ac yn cael eu dilyn i fyny."],
    ["records", "Radiographs & referrals", "C14", "Oral health promotion advice is recorded (Delivering Better Oral Health).", "Cofnodir cyngor hybu iechyd y geg (Delivering Better Oral Health)."],

    ["antibiotic", "Prescribing decisions", "A1", "The clinical indication for the antibiotic is recorded.", "Cofnodir yr arwydd clinigol ar gyfer y gwrthfiotig."],
    ["antibiotic", "Prescribing decisions", "A2", "Antibiotics are used only where indicated (not for irreversible pulpitis or localised abscess without systemic involvement where drainage or treatment suffices).", "Defnyddir gwrthfiotigau dim ond lle bo angen (nid ar gyfer pwlpitis anwrthdroadwy neu grawniad lleol heb gysylltiad systemig lle mae draenio neu driniaeth yn ddigonol)."],
    ["antibiotic", "Prescribing decisions", "A3", "The drug choice follows current national or local guidance.", "Mae dewis y cyffur yn dilyn canllawiau cenedlaethol neu leol cyfredol."],
    ["antibiotic", "Prescribing decisions", "A4", "Dose, frequency and duration are recorded and follow guidance.", "Cofnodir y dos, yr amledd a'r hyd ac maent yn dilyn canllawiau."],
    ["antibiotic", "Safety & follow-up", "A5", "Allergies and medical history were checked before prescribing.", "Gwiriwyd alergeddau a hanes meddygol cyn presgripsiynu."],
    ["antibiotic", "Safety & follow-up", "A6", "Advice on taking the antibiotic and what to do if symptoms worsen was given and recorded.", "Rhoddwyd a chofnodwyd cyngor ar gymryd y gwrthfiotig a beth i'w wneud os yw symptomau'n gwaethygu."],
    ["antibiotic", "Safety & follow-up", "A7", "A review or follow-up was arranged where appropriate.", "Trefnwyd adolygiad neu ddilyniant lle bo'n briodol."],
    ["antibiotic", "Safety & follow-up", "A8", "Prescription pads or e-prescribing records are managed securely and recorded in the log.", "Rheolir padiau presgripsiwn neu gofnodion e-bresgripsiynu yn ddiogel a'u cofnodi yn y log."],

    ["survey", "Running the survey", "S1", "A patient survey has been carried out in the last 12 months.", "Mae arolwg cleifion wedi'i gynnal yn y 12 mis diwethaf."],
    ["survey", "Running the survey", "S2", "The survey covers care, communication, cleanliness, access, dignity and the Welsh language, with enough responses to be meaningful.", "Mae'r arolwg yn cwmpasu gofal, cyfathrebu, glanweithdra, mynediad, urddas a'r Gymraeg, gyda digon o ymatebion i fod yn ystyrlon."],
    ["survey", "Running the survey", "S3", "The survey is available in Welsh and in accessible formats.", "Mae'r arolwg ar gael yn Gymraeg ac mewn fformatau hygyrch."],
    ["survey", "Acting on results", "S4", "Results are discussed with the whole team and recorded in meeting minutes.", "Trafodir y canlyniadau gyda'r tîm cyfan a'u cofnodi yng nghofnodion y cyfarfod."],
    ["survey", "Acting on results", "S5", "An action plan has been made and completed items are recorded.", "Mae cynllun gweithredu wedi'i wneud a chofnodir eitemau a gwblhawyd."],
    ["survey", "Acting on results", "S6", "Results and actions are shared with patients ('you said, we did').", "Rhennir canlyniadau a chamau gweithredu gyda chleifion ('dywedoch chi, gwnaethom ni')."],

    ["disability", "Getting in", "D1", "There is step-free access to the building and waiting room, or a documented reasonable alternative.", "Mae mynediad heb risiau i'r adeilad a'r ystafell aros, neu ddewis amgen rhesymol wedi'i ddogfennu."],
    ["disability", "Getting in", "D2", "Doorways are wide enough for wheelchair users and reserved or accessible parking is available.", "Mae drysau'n ddigon llydan i ddefnyddwyr cadair olwyn ac mae parcio neilltuedig neu hygyrch ar gael."],
    ["disability", "Facilities", "D3", "A wheelchair-accessible toilet is available.", "Mae toiled hygyrch i gadeiriau olwyn ar gael."],
    ["disability", "Facilities", "D4", "A hearing loop or equivalent is available and signed.", "Mae dolen glywed neu gyfwerth ar gael ac wedi'i harwyddo."],
    ["disability", "Information & people", "D5", "Patient information is available in accessible formats (large print, easy read, Welsh) on request.", "Mae gwybodaeth i gleifion ar gael mewn fformatau hygyrch (print mawr, hawdd ei ddarllen, Cymraeg) ar gais."],
    ["disability", "Information & people", "D6", "Reasonable adjustments for patients are asked about and recorded in their notes.", "Gofynnir am addasiadau rhesymol i gleifion a'u cofnodi yn eu nodiadau."],
    ["disability", "Information & people", "D7", "Staff have disability and autism awareness training, and an emergency evacuation plan covers patients who need assistance.", "Mae gan staff hyfforddiant ymwybyddiaeth o anabledd ac awtistiaeth, ac mae cynllun gwacáu brys yn cwmpasu cleifion sydd angen cymorth."]
  ];
  CC.AUDITS = A;
  if (typeof module !== "undefined" && module.exports) module.exports = A;
})();
