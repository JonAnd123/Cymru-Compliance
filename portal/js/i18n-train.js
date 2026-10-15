/* Welsh strings for group training, alerts and the HIW question hints (best-effort — please have a Welsh speaker proofread). Existing keys win. */
(function () {
  var cy = window.CC_CY = window.CC_CY || {};
  var add = {
    "Group training": "Hyfforddiant grŵp", "Assign training": "Neilltuo hyfforddiant", "Assign training across practices": "Neilltuo hyfforddiant ar draws practisau",
    "Assign training across your practices and track completion in one place.": "Neilltuwch hyfforddiant ar draws eich practisau a thracio cwblhau mewn un lle.",
    "Assignments": "Neilltuadau", "across {n} practices": "ar draws {n} practis", "{a} of {b} assignments": "{a} o {b} neilltuad", "{n} practices affected": "{n} practis wedi'u heffeithio",
    "Completion by practice": "Cwblhau yn ôl practis", "Overall": "Cyfanswm", "Each cell shows completed / assigned. Red means at least one person is overdue.": "Mae pob cell yn dangos wedi'u cwblhau / wedi'u neilltuo. Mae coch yn golygu bod o leiaf un person yn hwyr.",
    "Overdue training": "Hyfforddiant hwyr", "{n} days overdue": "{n} diwrnod yn hwyr", "Nothing overdue. Well done.": "Dim yn hwyr. Da iawn.",
    "Training modules": "Modiwlau hyfforddi", "Practices": "Practisau", "Who": "Pwy", "Due date": "Dyddiad cyflwyno", "People who already have a module assigned are skipped.": "Hepgorir pobl sydd eisoes â modiwl wedi'i neilltuo.",
    "Choose at least one module.": "Dewiswch o leiaf un modiwl.", "Choose at least one practice.": "Dewiswch o leiaf un practis.", "Choose at least one role.": "Dewiswch o leiaf un rôl.",
    "No active people match your selection.": "Does dim pobl weithredol yn cyfateb i'ch dewis.", "Training assigned to {n} people.": "Hyfforddiant wedi'i neilltuo i {n} o bobl.",
    "Alerts": "Rhybuddion", "Items that have expired or expire within {n} days.": "Eitemau sydd wedi dod i ben neu'n dod i ben o fewn {n} diwrnod.",
    "Expired / overdue": "Wedi dod i ben / yn hwyr", "Due within 14 days": "Yn ddyledus o fewn 14 diwrnod", "Due within {n} days": "Yn ddyledus o fewn {n} diwrnod",
    "All types": "Pob math", "All urgency": "Pob brys", "Later": "Yn hwyrach", "Urgent": "Brys", "Soon": "Cyn bo hir", "Item": "Eitem", "Type": "Math", "Date": "Dyddiad", "Open": "Agor",
    "GDC registration": "Cofrestriad GDC", "Indemnity": "Indemniad", "DBS": "DBS", "Training overdue": "Hyfforddiant hwyr", "HIW inspection": "Arolygiad AGIC", "Next HIW inspection": "Arolygiad AGIC nesaf",
    "today": "heddiw", "in {n} days": "ymhen {n} diwrnod", "expired {n} days ago": "daeth i ben {n} diwrnod yn ôl",
    "No alerts. Everything is in date.": "Dim rhybuddion. Mae popeth o fewn dyddiad.", "Email reminders": "Nodiadau atgoffa e-bost",
    "Email me a reminder when items are about to expire": "Anfonwch nodyn atgoffa e-bost ataf pan fydd eitemau ar fin dod i ben",
    "Reminders are sent at 60, 30, 14 and 0 days before an item expires, and once it has expired.": "Anfonir nodiadau atgoffa 60, 30, 14 a 0 diwrnod cyn i eitem ddod i ben, ac unwaith y bydd wedi dod i ben.",
    "Email reminders are only sent in the live version. This preference is saved here for the demo.": "Dim ond yn y fersiwn byw yr anfonir nodiadau atgoffa e-bost. Cedwir y dewis hwn yma ar gyfer y demo.",
    "Evidence source": "Ffynhonnell tystiolaeth"
  };
  Object.keys(add).forEach(function (k) { if (!(k in cy)) cy[k] = add[k]; });
})();
