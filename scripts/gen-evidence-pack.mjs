// Evidence Pack — ออกผลตรง sheet "TestResult" (ไฟล์ 2) ราย Test Case + หลักฐานราย step + วิดีโอ
// เติม 5 คอลัมน์ผล: Test Result · Result Note · Remark · Test Date · Test By
// (คอลัมน์ design อื่น ๆ บน Lark เป็น lookup จาก TestCases — ที่นี่ใส่เท่าที่ automation รู้)
// รัน: node scripts/gen-evidence-pack.mjs  (ผ่าน npm run evidence / npm run capture)
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const RESULTS = path.join(ROOT, 'test-results', 'results.json');
const STEPS_DIR = path.join(ROOT, 'test-results', 'steps');
const E2E_MD = path.resolve(ROOT, '../examples/hrms-login/hrms-login-e2e-execution.md');
const PACK = path.join(ROOT, 'test-results', 'evidence-pack');
const IMG = path.join(PACK, 'evidence');
const VID = path.join(PACK, 'videos');
const STATUS = { passed: 'PASSED', failed: 'FAILED', timedOut: 'FAILED', interrupted: 'FAILED', skipped: 'SKIPPED' };
const TEST_BY = process.env.TEST_BY || 'Automation (Playwright)';

if (!fs.existsSync(RESULTS)) {
  console.error('ไม่พบ test-results/results.json — รัน `npm test` ก่อน');
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(RESULTS, 'utf8'));
const testDate = (data.finishedAt || new Date().toISOString()).slice(0, 10);

// ID → รูปแบบทีม: TS01 → TS-01 · TS01_TC01 → TS-01_TC-01
const seg = (s) => s.replace(/^([A-Za-z]+)(\d+)$/, '$1-$2');
const dashify = (s) => s.split('_').map(seg).join('_');
const scenarioNoOf = (id) => dashify(id.split('_').pop()); // HRMS_LOGIN_TS01 → TS-01
const category = (id) => (/_(TA|SEC)\d/.test(id) ? 'NEGATIVE' : 'POSITIVE');

// Scenario Name จาก E2E sheet
const sname = {};
if (fs.existsSync(E2E_MD)) {
  for (const b of fs.readFileSync(E2E_MD, 'utf8').split(/\n##\s+/).slice(1)) {
    const head = b.split('\n')[0];
    const idm = head.match(/(HRMS_LOGIN_[A-Z0-9]+)/);
    if (idm) sname[idm[1]] = (head.match(/—\s*(.+?)(?:\s*\([^)]*\))?\s*$/) || [])[1]?.trim() || head;
  }
}

fs.rmSync(PACK, { recursive: true, force: true });
fs.mkdirSync(IMG, { recursive: true });
fs.mkdirSync(VID, { recursive: true });

// คอลัมน์ตรงตาราง Lark Base tblIwUWXkWNLYy4c (template ใหม่ 1 sheet — 2026-06-11)
// เปลี่ยน: TestcaseNo → TC No. | เพิ่ม Project Name/Product/Feature/Data Test/RelateDefectURL/Defect Types/Testing Round
const COLS = [
  'Project Name', 'Product', 'Feature',
  'Scenario No.', 'Scenario Name', 'Business Conditions',
  'Arrange (สิ่งที่ต้องเตรียมก่อนการทดสอบ)',
  'TC No.', 'Case Title Name', 'Test category', 'Test Type',
  'Test Steps', 'Data Test', 'Expected Result', 'UI Design',
  'Test Result', 'Result Note', 'Test Date', 'Test By', 'Remark',
  'RelateDefectURL', 'Defect Types', 'Testing Round',
];
const csv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const lines = [COLS.map(csv).join(',')];
const records = [];
let imgCount = 0, vidCount = 0, rowCount = 0;

for (const r of data.results) {
  const scNo = scenarioNoOf(r.scenarioId);
  const scName = sname[r.scenarioId] || r.title;
  const cat = category(r.scenarioId);

  // วิดีโอ walkthrough ต่อ scenario (1 TS = 1 วิดีโอ ใช้ร่วมทุก TC)
  const vid = r.attachments.find((a) => /\.webm$/i.test(a.path));
  if (r.status !== 'skipped' && vid && fs.existsSync(path.join(ROOT, vid.path))) {
    fs.copyFileSync(path.join(ROOT, vid.path), path.join(VID, `${scNo}.webm`));
    vidCount++;
  }
  const scnVideo = fs.existsSync(path.join(VID, `${scNo}.webm`)) ? path.join(VID, `${scNo}.webm`) : null;

  // ราย step (ถ้าไม่มี = scenario-level เช่น skipped)
  const steps = r.steps && r.steps.length ? r.steps : [{ tc: r.scenarioId, title: r.title, failed: false, scn: true }];
  for (const st of steps) {
    const tcNo = st.scn ? scNo : dashify(st.tc);
    const result = st.scn ? (STATUS[r.status] || r.status) : st.failed ? 'FAILED' : 'PASSED';
    let note = r.status === 'skipped' ? '(skipped)' : '';
    let eviFile = null;
    if (!st.scn && r.status !== 'skipped') {
      const src = path.join(STEPS_DIR, `${st.tc}.png`);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(IMG, `${tcNo}.png`));
        note = `evidence/${tcNo}.png`;
        eviFile = path.join(IMG, `${tcNo}.png`);
        imgCount++;
      }
    }
    const testBy = r.status === 'skipped' ? '' : TEST_BY;
    const caseTitle = st.scn ? scName : st.title;
    const tSteps = st.scn ? '' : st.title;
    // คอลัมน์ตาม COLS ใหม่ (1 sheet): Project Name, Product, Feature, Scenario No., Scenario Name,
    // Business Conditions, Arrange, TC No., Case Title Name, Test category, Test Type,
    // Test Steps, Data Test, Expected Result, UI Design,
    // Test Result, Result Note, Test Date, Test By, Remark,
    // RelateDefectURL, Defect Types, Testing Round
    lines.push(
      ['', '', '', scNo, scName, '', '', tcNo, caseTitle, cat, 'SYSTEMTEST',
       tSteps, '', '', '', result, note, testDate, testBy, '', '', '', ''].map(csv).join(','),
    );
    records.push({
      scenarioNo: scNo, scenarioName: scName, tcNo, caseTitle, testCategory: cat,
      testType: 'SYSTEMTEST', testSteps: tSteps, dataTest: '', expectedResult: '',
      testResult: result, evidenceFile: eviFile, videoFile: scnVideo,
      remark: '', testDate, testBy,
    });
    rowCount++;
  }
}

fs.writeFileSync(path.join(PACK, 'records.json'), JSON.stringify(records, null, 2));
fs.writeFileSync(path.join(PACK, 'lark-test-result-import.csv'), '﻿' + lines.join('\n'));

const passed = data.results.filter((r) => r.status === 'passed').length;
const failed = data.results.filter((r) => ['failed', 'timedOut', 'interrupted'].includes(r.status)).length;
fs.writeFileSync(
  path.join(PACK, 'README.md'),
  `# Evidence Pack → Lark Base tblIwUWXkWNLYy4c — ${data.finishedAt}

scenario: ✅ ${passed} · ❌ ${failed} · รวม ${data.results.length} · แถวราย TC ${rowCount} · ภาพ ${imgCount} · วิดีโอ ${vidCount}

## เก็บผลเข้า Lark Base (template ใหม่ 1 sheet — 2026-06-11)
คอลัมน์ใน \`lark-test-result-import.csv\` ตรงตาราง **tblIwUWXkWNLYy4c** — TC No. รูปแบบ \`TS-01_TC-01\`
- automation เติม: **TC No. · Test Result · Result Note (evidence path) · Test Date · Test By**
- คอลัมน์ที่เว้นว่าง (Project/Product/Feature/Steps/Expected ฯลฯ) lookup จาก upload:tc แล้ว — ไม่ต้องเติมซ้ำ
- Import CSV → ลาก \`evidence/<TC>.png\` ลง **Result Note** · วิดีโอที่ \`videos/<Scenario>.webm\`
- ยิงอัตโนมัติ: \`npm run file:lark -- --confirm\` (upsert key = TC No.)
- FAILED → เปิด bug card จาก \`../bug-cards/\`
`,
);

console.log(
  `Evidence pack → test-results/evidence-pack/ (สคีมา TestResult)\n` +
    `  • lark-test-result-import.csv — ${rowCount} แถว (16 คอลัมน์)\n` +
    `  • evidence/*.png — ${imgCount} · videos/*.webm — ${vidCount}\n` +
    `→ Import เข้า sheet TestResult / หรือ npm run file:lark -- --confirm`,
);
