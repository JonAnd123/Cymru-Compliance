global.window = {}; global.window.CC = {};
const fs = require("fs"); const R = "/sessions/vigilant-bold-mccarthy/mnt/Cymru Compliance/website/portal/js/";
global.CC = window.CC;
eval(fs.readFileSync(R + "tools-content.js", "utf8")); eval(fs.readFileSync(R + "audit-content.js", "utf8"));
console.log(JSON.stringify({ freq: CC.TOOLS.FREQ.map(f => f[0]), logs: CC.TOOLS.LOGS.map(l => l.key), policies: CC.TOOLS.POLICIES, audits: CC.AUDITS.Q, courses: CC.TOOLS.COURSES.map(c=>c[0]), recruit: CC.TOOLS.RECRUIT.map(c=>c[0]) }));
