// ask-po — สร้าง Records ใน Lark Base (PO Questions) + เก็บ state รอคำตอบ
// DRY-RUN by default · --confirm จึงสร้างจริง
//
// po-questions.json: [{ "id":"Q1","topic":"...","proposed":"...","affects":"..." }, ...]
// env: LARK_APP_ID, LARK_APP_SECRET, PO_FEATURE, PO_TABLE_ID
// lark.config.json ต้องมี: poAppToken (Base wiki token), apiBase, authMode:"user"
import fs from 'fs';
import path from 'path';
import { getAccessToken } from './lark-auth.mjs';

const ROOT = process.cwd();
const CONFIRM = process.argv.includes('--confirm');
const qFile = process.argv.find((a) => a.endsWith('.json') && !a.includes('lark.config')) || path.join(ROOT, 'po-questions.json');
const STATE_DIR = path.join(ROOT, '.po-loop');
const cfgPath = path.join(ROOT, 'lark.config.json');

if (!fs.existsSync(qFile)) { console.error('ไม่พบไฟล์คำถาม:', qFile, '(ดู po-questions.example.json)'); process.exit(1); }
const questions = JSON.parse(fs.readFileSync(qFile, 'utf8'));
const cfg = fs.existsSync(cfgPath) ? JSON.parse(fs.readFileSync(cfgPath, 'utf8')) : {};
const feature = process.env.PO_FEATURE || 'feature';
const poAppToken = process.env.PO_APP_TOKEN || cfg.poAppToken;
const poTableId  = process.env.PO_TABLE_ID  || cfg.poTableId;

// สร้าง records: Feature + Question (Q_ID รันเองโดย Base formula)
// q.feature: string หรือ array (multi-select) · ถ้าไม่มี → ใช้ PO_FEATURE global
const records = questions.map((q) => {
  const featureVal = q.feature
    ? (Array.isArray(q.feature) ? q.feature : [q.feature])
    : [feature];
  const questionText = q.proposed ? `${q.topic}\n\n${q.proposed}` : q.topic;
  return { fields: { Feature: featureVal, Question: questionText } };
});

const ready = CONFIRM && poAppToken && poTableId && process.env.LARK_APP_ID && process.env.LARK_APP_SECRET;
if (!ready) {
  console.log('=== DRY RUN (ยังไม่สร้างใน Lark Base) ===');
  if (!CONFIRM)      console.log('• ยังไม่ใส่ --confirm');
  if (!poAppToken)   console.log('• ตั้ง PO_APP_TOKEN หรือ poAppToken ใน lark.config.json');
  if (!poTableId)    console.log('• ตั้ง PO_TABLE_ID (env) หรือ poTableId ใน lark.config.json');
  if (!process.env.LARK_APP_ID) console.log('• ตั้ง env LARK_APP_ID/SECRET');
  console.log('\n--- Records ที่จะสร้างใน Lark Base ---');
  for (const r of records) {
    console.log(`Feature : ${r.fields.Feature}`);
    console.log(`Question:\n${r.fields.Question}`);
    console.log('---');
  }
  console.log(`\nรวม ${records.length} records`);
  process.exit(0);
}

// สร้าง records จริง
const base = (cfg.apiBase || 'https://open.larksuite.com').replace(/\/$/, '');
const token = await getAccessToken(cfg);

// Feature เป็น Single Select (type 3) → ต้อง ensure options มีอยู่ก่อน
const featureValues = [...new Set(
  questions.flatMap((q) => q.feature
    ? (Array.isArray(q.feature) ? q.feature : [q.feature])
    : [feature]
  )
)];
const fieldsRes = await fetch(
  `${base}/open-apis/bitable/v1/apps/${poAppToken}/tables/${poTableId}/fields`,
  { headers: { Authorization: `Bearer ${token}` } }
).then((r) => r.json());
const featureField = fieldsRes.data?.items?.find((f) => f.field_name === 'Feature');
if (featureField?.type === 3 || featureField?.type === 4) {
  // ⚠️ ต้องเก็บ option objects เดิม (พร้อม id/color) ไว้ครบ — ถ้าส่งแค่ name ใหม่ Lark จะ re-create ทุก option
  // และ records เก่าที่ผูกกับ option id เดิมจะสูญเสีย value ทันที
  const existingOptions = featureField.property?.options || [];
  const existingNames   = existingOptions.map((o) => o.name);
  const toAdd = featureValues.filter((v) => !existingNames.includes(v));
  if (toAdd.length > 0) {
    // คง existing options ไว้พร้อม id/color, เพิ่มแค่ของใหม่ (ไม่มี id → Lark สร้างให้)
    const allOptions = [...existingOptions, ...toAdd.map((name) => ({ name }))];
    await fetch(
      `${base}/open-apis/bitable/v1/apps/${poAppToken}/tables/${poTableId}/fields/${featureField.field_id}`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ field_name: 'Feature', type: featureField.type, property: { options: allOptions } }),
      }
    ).then((r) => r.json());
    console.log(`→ เพิ่ม Feature options: ${toAdd.join(', ')}`);
  }
}

const res = await fetch(
  `${base}/open-apis/bitable/v1/apps/${poAppToken}/tables/${poTableId}/records/batch_create`,
  {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ records }),
  }
).then((r) => r.json());

if (res.code !== 0) { console.error('สร้าง records ไม่สำเร็จ:', JSON.stringify(res)); process.exit(1); }

const created = res.data?.records || [];
fs.mkdirSync(STATE_DIR, { recursive: true });
fs.writeFileSync(path.join(STATE_DIR, 'pending.json'), JSON.stringify({
  feature, poAppToken, poTableId,
  sentAt: Math.floor(Date.now() / 1000),
  records: created.map((r, i) => ({
    recordId: r.record_id,
    id: questions[i].id,
    topic: questions[i].topic,
    proposed: questions[i].proposed,
    status: 'open',
    answer: null,
  })),
}, null, 2));

console.log(`✅ สร้าง ${created.length} records ใน Lark Base แล้ว`);
console.log(`→ PO เปิดตาราง แล้วกรอกคอลัมน์ "Answer"`);
console.log(`→ poll คำตอบด้วย: npm run poll:po`);
