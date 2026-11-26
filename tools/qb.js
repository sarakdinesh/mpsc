#!/usr/bin/env node
/* प्रश्नसंच साधन (questions.js)
 *   node tools/qb.js check   तपासणी (questions.js + current-affairs.js): रचना, 4 वेगळे पर्याय, उत्तर क्रमांक, ID अद्वितीय, धडा अस्तित्वात
 *   node tools/qb.js ids     ID नसलेल्या प्रश्नांना पुढचा ID देतो (जुने ID कधीच बदलत नाहीत) व फाइल नीट मांडतो
 *   node tools/qb.js stats   विषय/वर्ष/तपासणी-स्थितीनुसार संख्या
 *
 * प्रश्नाचा आकार: [प्रश्न, [4 पर्याय], उत्तर (0–3), स्पष्टीकरण, मेटा]
 * मेटा:
 *   i   स्थिर ID, उदा. "pl1-007". एकदा दिलेला ID कधीही बदलू नका किंवा दुसऱ्या प्रश्नाला देऊ नका.
 *       प्रश्न काढायचा असेल तर तो हटवण्याऐवजी x:1 लावा (म्हणजे जुनी प्रगती तुटत नाही).
 *   y   "2022" = त्या वर्षीच्या मूळ प्रश्नपत्रिकेतील प्रश्न; "pyq" = पूर्वपरीक्षा-शैलीचा प्रश्न
 *   n   मूळ प्रश्नपत्रिकेतील प्रश्न क्रमांक (y वर्ष असेल तेव्हा)
 *   v   तपासणी: "k" = आयोगाच्या अंतिम उत्तरतालिकेशी जुळवले; "s" = src मधील स्रोताशी तपासले
 *   src स्रोत (मजकूर किंवा URL)
 *   u   1 = अलीकडची/अनिश्चित माहिती, परीक्षेपूर्वी पुन्हा तपासा
 *   c   1 = आयोगाने अंतिम उत्तरतालिकेत रद्द केलेला प्रश्न (सरावात दिसतो, मॉकमध्ये नाही)
 *   x   1 = निवृत्त प्रश्न (दिसत नाही; ID राखीव)
 */
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.join(__dirname, ".."), FILE = path.join(ROOT, "questions.js");

function load() {
  const ctx = {};
  vm.runInNewContext(fs.readFileSync(FILE, "utf8").replace(/^const QB\s*=/m, "QB="), ctx);
  return ctx.QB;
}
// चालू घडामोडी स्वतंत्र current-affairs.js मध्ये (CA.L धडे, CA.Q प्रश्न); तपासणीत तेही धरतो
function loadCA() {
  const f = path.join(ROOT, "current-affairs.js"); if (!fs.existsSync(f)) return { L: [], Q: {} };
  const ctx = {}; vm.runInNewContext(fs.readFileSync(f, "utf8").replace(/^const CA\s*=/m, "CA=") , ctx);
  return ctx.CA || { L: [], Q: {} };
}
function lessonIds() {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  return [...html.matchAll(/\{id:"([a-z]+\d+)",s:"([a-z]+)",t:"([^"]*)"/g)].map(m => ({ id: m[1], s: m[2], t: m[3] }));
}
const meta = q => (q[4] && typeof q[4] === "object" ? q[4] : null);
const ID_RE = /^([a-z]+\d+)-(\d{3,})$/;
// चालू घडामोडी (ca1–ca8) current-affairs.js मध्ये; questions.js च्या ids/पुनर्मांडणीत त्यांना हात लावत नाही.
const SKIP = /^ca\d+$/;

function check(QB, L) {
  const errs = [], seenId = new Map(), ids = new Set(L.map(l => l.id));
  for (const [lid, arr] of Object.entries(QB)) {
    if (!ids.has(lid)) errs.push(`धडा नाही: ${lid}`);
    arr.forEach((q, k) => {
      const at = `${lid}[${k}]`;
      if (!Array.isArray(q) || typeof q[0] !== "string" || !q[0].trim()) return errs.push(`${at}: प्रश्न मजकूर नाही`);
      if (!Array.isArray(q[1]) || q[1].length !== 4) errs.push(`${at}: 4 पर्याय हवेत`);
      else if (new Set(q[1].map(o => String(o).trim())).size !== 4) errs.push(`${at}: पर्याय पुनरावृत्त`);
      if (!Number.isInteger(q[2]) || q[2] < 0 || q[2] > 3) errs.push(`${at}: उत्तर 0–3 हवे`);
      if (typeof q[3] !== "string") errs.push(`${at}: स्पष्टीकरण नाही`);
      const m = meta(q);
      if (q.length > 5 || (q[4] !== undefined && !m)) errs.push(`${at}: मेटा चुकीचा`);
      if ((!m || !m.i) && !SKIP.test(lid)) errs.push(`${at}: ID नाही (node tools/qb.js ids चालवा)`);
      else if (m && m.i) {
        const mm = ID_RE.exec(m.i);
        if (!mm || mm[1] !== lid) errs.push(`${at}: ID ${m.i} या धड्याचा नाही`);
        if (seenId.has(m.i)) errs.push(`${at}: ID ${m.i} पुन्हा (${seenId.get(m.i)})`);
        seenId.set(m.i, at);
      }
      if (m) {
        if (m.y && !/^(pyq|20\d\d)$/.test(m.y)) errs.push(`${at}: y चुकीचे`);
        if (m.n !== undefined && (!/^20\d\d$/.test(m.y || "") || !Number.isInteger(m.n))) errs.push(`${at}: n साठी y वर्ष व पूर्णांक हवा`);
        if (m.v && !["k", "s"].includes(m.v)) errs.push(`${at}: v चुकीचे`);
        if (m.v === "s" && !m.src) errs.push(`${at}: v:"s" साठी src हवा`);
      }
    });
  }
  return errs;
}

function fmt(QB, L) {
  const title = Object.fromEntries(L.map(l => [l.id, l.s + " · " + l.t]));
  const head = fs.readFileSync(FILE, "utf8").split(/^const QB\s*=/m)[0];
  let out = head + "const QB={\n";
  const orig = {};
  for (const p of fs.readFileSync(FILE, "utf8").split(/(?=^\/\* [a-z]+ · )/m)) { const k = (p.match(/^([a-z]+\d+):\[/m) || [])[1]; if (k) orig[k] = p.replace(/\};\s*$/, ""); }
  for (const l of L) {
    if (SKIP.test(l.id) && orig[l.id]) { out += orig[l.id]; continue; }
    const arr = QB[l.id] || [];
    out += `/* ${title[l.id]} */\n${l.id}:[\n` + arr.map(q => JSON.stringify(q)).join(",\n") + "\n],\n";
  }
  for (const id of Object.keys(QB)) if (!title[id]) throw "अज्ञात धडा " + id;
  return out + "};\n";
}

function assignIds(QB) {
  let added = 0;
  for (const [lid, arr] of Object.entries(QB)) {
    if (SKIP.test(lid)) continue;
    let max = 0;
    for (const q of arr) { const m = meta(q), mm = m && m.i && ID_RE.exec(m.i); if (mm) max = Math.max(max, +mm[2]); }
    for (const q of arr) {
      if (meta(q) && meta(q).i) continue;
      const m = { i: `${lid}-${String(++max).padStart(3, "0")}`, ...(meta(q) || {}) };
      q[4] = m; added++;
    }
  }
  return added;
}

const cmd = process.argv[2] || "check";
const QB = load(), L = lessonIds();
if (cmd === "ids") {
  const n = assignIds(QB);
  fs.writeFileSync(FILE, fmt(QB, L));
  console.log(`नवीन ID: ${n}`);
}
if (cmd === "check" || cmd === "ids") {
  const CA = loadCA();
  const errs = check({ ...load(), ...CA.Q }, [...L, ...CA.L.map(l => ({ id: l.id, s: l.s, t: l.t }))]);
  const total = Object.values({ ...load(), ...CA.Q }).reduce((a, x) => a + x.length, 0);
  if (errs.length) { console.error(errs.join("\n")); console.error(`${errs.length} चुका`); process.exit(1); }
  console.log(`ठीक: ${total} प्रश्न`);
}
if (cmd === "stats") {
  const by = {}, yr = {}, v = { k: 0, s: 0, none: 0 };
  const sOf = Object.fromEntries(L.map(l => [l.id, l.s]));
  for (const [lid, arr] of Object.entries(QB)) for (const q of arr) {
    const m = meta(q) || {}; if (m.x) continue;
    by[sOf[lid]] = (by[sOf[lid]] || 0) + 1;
    if (m.y) yr[m.y] = (yr[m.y] || 0) + 1;
    v[m.v || "none"]++;
  }
  console.log({ विषय: by, वर्ष: yr, तपासणी: v });
}
