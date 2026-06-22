// poll-po — อ่าน Records จาก Lark Base · เช็ค Answer column → ครบทุกข้อ? exit 2 → answers.json
// read-only (ไม่มี side-effect) → รันซ้ำ / ตั้ง schedule ได้
import fs from 'fs';
import path from 'path';
import { getAccessToken } from './lark-auth.mjs';

const ROOT = process.cwd();
const STATE_DIR = path.join(ROOT, '.po-loop');
const pendingPath = path.join(STATE_DIR, 'pending.json');
const cfgPath = path.join(ROOT, 'lark.config.json');

if (!fs.existsSync(pendingPath)) { console.log('ยังไม่มี pending.json — รัน ask:po (--confirm) ก่อน'); process.exit(0); }
const pending = JSON.parse(fs.readFileSync(pendingPath, 'utf8'));
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));

if (!process.env.LARK_APP_ID) { console.log('ตั้ง env LARK_APP_ID/SECRET ก่อน'); process.exit(0); }

const base = (cfg.apiBase || 'https://open.larksuite.com').replace(/\/$/, '');
const token = await getAccessToken(cfg);
const { poAppToken, poTableId, records: pendingRecords } = pending;

// ดึง records ทั้งหมดจาก table (paginate ถ้าเกิน 100)
const allItems = [];
let pageToken = '';
do {
  const url = `${base}/open-apis/bitable/v1/apps/${poAppToken}/tables/${poTableId}/records`
    + `?page_size=100${pageToken ? `&page_token=${pageToken}` : ''}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then((x) => x.json());
  if (r.code !== 0) { console.error('อ่าน records ไม่สำเร็จ:', JSON.stringify(r)); process.exit(1); }
  for (const item of r.data?.items || []) allItems.push(item);
  pageToken = r.data?.has_more ? r.data.page_token : '';
} while (pageToken);

// จับคู่ record_id → Answer
const recordMap = Object.fromEntries(allItems.map((r) => [r.record_id, r.fields]));

const updated = pendingRecords.map((pr) => {
  const fields = recordMap[pr.recordId] || {};
  const raw = fields.Answer;
  const answer = typeof raw === 'string' ? raw.trim() : (raw?.text?.trim?.() ?? null);
  return { ...pr, status: answer ? 'answered' : 'open', answer: answer || null };
});

// แสดงสถานะ
const answeredCount = updated.filter((r) => r.status === 'answered').length;
console.log(`📊 ตอบแล้ว ${answeredCount}/${updated.length} ข้อ`);
for (const r of updated) {
  const icon = r.status === 'answered' ? '✅' : '⏳';
  console.log(`  ${icon} ${r.id} — ${r.topic}${r.answer ? ': ' + r.answer : ''}`);
}

// save state
fs.writeFileSync(pendingPath, JSON.stringify({ ...pending, records: updated }, null, 2));

if (answeredCount < updated.length) {
  const openIds = updated.filter((r) => r.status === 'open').map((r) => r.id).join(', ');
  console.log(`\n⏳ ยังไม่ครบ (${openIds}) — poll ใหม่อีกรอบ`);
  process.exit(0);
}

// ครบทุกข้อ → เขียน answers.json → exit 2
const answers = Object.fromEntries(updated.map((r) => [r.id, { topic: r.topic, proposed: r.proposed, answer: r.answer }]));
fs.writeFileSync(
  path.join(STATE_DIR, 'answers.json'),
  JSON.stringify({ feature: pending.feature, answers }, null, 2),
);
console.log('\n🎉 ตอบครบแล้ว → .po-loop/answers.json พร้อม resume design');
process.exit(2);
