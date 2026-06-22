// ชั้น TRIAGE + CARD (แนวทาง A: Draft + วางเอง)
// อ่านผล failure → ดึง repro steps จาก E2E execution sheet → สร้าง bug card draft (.md)
// คน "ตรวจแล้ววางเอง" เข้า Meegle (หรือใช้สกิลทีม /meegle-tech-task เปิดการ์ด QA)
// รัน: node scripts/gen-bug-cards.mjs   (ปกติเรียกผ่าน `npm run cards` หลัง `npm test`)
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const RESULTS = path.join(ROOT, 'test-results', 'results.json');
const E2E_MD = path.resolve(ROOT, '../examples/hrms-login/hrms-login-e2e-execution.md');
const OUT = path.join(ROOT, 'test-results', 'bug-cards');
const FAIL = ['failed', 'timedOut', 'interrupted'];

if (!fs.existsSync(RESULTS)) {
  console.error('ไม่พบ test-results/results.json — รัน `npm test` ก่อน');
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(RESULTS, 'utf8'));

// ---- parse E2E execution sheet เพื่อดึง priority + steps ต่อ scenario ----
const sections = {};
if (fs.existsSync(E2E_MD)) {
  const blocks = fs.readFileSync(E2E_MD, 'utf8').split(/\n##\s+/).slice(1);
  for (const b of blocks) {
    const head = b.split('\n')[0];
    const idm = head.match(/(HRMS_LOGIN_[A-Z0-9]+)/);
    if (!idm) continue;
    const priority = (head.match(/\(([^)]+)\)\s*$/) || [])[1]?.trim() || '';
    const desc = (head.match(/—\s*(.+?)(?:\s*\([^)]*\))?\s*$/) || [])[1]?.trim() || head;
    const steps = b
      .split('\n')
      .filter((l) => /^\|\s*(\d|—)/.test(l))
      .map((r) => {
        const c = r.split('|').map((x) => x.trim());
        return `${c[1]}. ${c[2]} → ${c[3]}`;
      });
    sections[idm[1]] = { priority, desc, steps };
  }
}

const failed = data.results.filter((r) => FAIL.includes(r.status));
if (!failed.length) {
  console.log('ไม่มี failure 🎉 ไม่ต้องเปิดการ์ด');
  process.exit(0);
}

fs.mkdirSync(OUT, { recursive: true });

// --- ค่าคงที่ของชุดนี้ (เปลี่ยนเมื่อย้ายไป feature/ระบบอื่น) — ดู examples/meegle-bug-template.md ---
const PRODUCT = 'HRMS';
const MODULE = 'Login';
const ENV_TAG = 'SIT';
const URL = 'https://frontend-v2.hrms-sit.skyai.co.th/login';
const PRIO_MAP = { Critical: 'High', High: 'High', Medium: 'Medium', Low: 'Low' }; // → Meegle Priority
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const t = new Date();
const dateStr = `${String(t.getDate()).padStart(2, '0')} ${MONTHS[t.getMonth()]} ${t.getFullYear()}`;

const cards = [];
for (const r of failed) {
  const s = sections[r.scenarioId] || { priority: 'High', desc: r.title, steps: [] };
  const sevRaw = (s.priority.split('/')[0] || 'High').trim(); // Critical/High/Medium/Low
  const prio = PRIO_MAP[sevRaw] || 'High';                    // Meegle Priority
  const name = `[${PRODUCT}][${ENV_TAG}] ${MODULE} - ${s.desc} [${r.scenarioId}]`;
  const steps = s.steps.length ? s.steps.join('\n') : '(ดู E2E execution sheet ของ scenario นี้)';
  const attach = r.attachments.length
    ? r.attachments.map((a) => `- ${a.name}: ${a.path}`).join('\n')
    : '- (แนบ screenshot/video เพิ่มได้ตามต้องการ)';

  // body ตาม Descriptions template ของการ์ด Meegle
  const body = `Date: ${dateStr}
Product/Project: ${PRODUCT}
Module: ${MODULE}
Function: <ระบุฟังก์ชันของ ${r.scenarioId}>
Environment: ${ENV_TAG}
URL: ${URL}
----------------------------------------------------------------------
Description: scenario "${s.desc}" — automated E2E test ไม่ผ่าน (severity เดิม: ${sevRaw})

Steps to Reproduce
${steps}

Actual Result: (จาก Playwright)
${(r.error || 'failed').trim()}
[แนบ screenshot/video ตาม Attachments ด้านล่าง]

Expected Result: เป็นไปตาม scenario "${s.desc}" + แนบรูป/วิดีโอ`;

  const cardMd = `# Bug Card (draft) — ${r.scenarioId}

> วางลงการ์ด Meegle: ตาราง 📋 → ฟิลด์บนการ์ด · บล็อก 📝 → ช่อง Descriptions

## 📋 Meegle fields
| ฟิลด์ | ค่า |
|---|---|
| **Name** ✱ | ${name} |
| **Priority** ✱ | ${prio} |
| **Environment** ✱ | ${ENV_TAG} |
| **Issue type** ✱ | Basic workflow |
| **Reporter** ✱ | (auto = ตัวเอง) |
| **Assignee** ✱ | ⚠️ เลือก Dev ผู้รับผิดชอบ |
| **Linked Function** ✱ | ⚠️ เลือก Function ที่เกี่ยวข้อง |
| **Schedule (Estimate)** ✱ | ⚠️ เลือกวันที่ประเมิน |

## 📝 Descriptions (คัดลอกทั้งบล็อก)
\`\`\`
${body}
\`\`\`

## 📎 Attachments (หลักฐานจากการรัน)
${attach}

---
_Test: \`${r.file}:${r.line}\` · Run: ${data.finishedAt} · **ตรวจก่อนเปิดการ์ด** · format: examples/meegle-bug-template.md_
`;
  fs.writeFileSync(path.join(OUT, `${r.scenarioId}.md`), cardMd);
  cards.push({ scenarioId: r.scenarioId, name, priority: prio, severity: sevRaw, test: `${r.file}:${r.line}` });
}
fs.writeFileSync(path.join(OUT, '_index.json'), JSON.stringify(cards, null, 2));
console.log(
  `สร้าง ${cards.length} bug card draft → test-results/bug-cards/*.md  (รูปแบบ Meegle: ฟิลด์ + Descriptions พร้อมวาง)\n` +
    `→ ตรวจแล้ว "วางเอง" เข้า Meegle (หรือเปิดการ์ด QA ด้วยสกิล /meegle-tech-task)`,
);
