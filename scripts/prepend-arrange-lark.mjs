#!/usr/bin/env node
// Prepend "Login User / Role" header ลงฟิลด์ Arrange ของทุก record ตาม Feature (ทำงานบน Lark Base โดยตรง)
// รัน: node scripts/prepend-arrange-lark.mjs [--confirm]
// DRY-RUN by default · --confirm จึงเขียนจริง · idempotent (ข้าม record ที่ขึ้นต้น "Login User:" แล้ว)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAccessToken } from './lark-auth.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIRM = process.argv.includes('--confirm');
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'lark.config.json'), 'utf8'));
const base = cfg.apiBase, APP = cfg.tcAppToken, TBL = cfg.tcTableId;
const ARRANGE = 'Arrange (สิ่งที่ต้องเตรียมก่อนการทดสอบ)';
const DIVIDER = '----------------------------';

// Feature → Role header
const HEADER = {
  'Customer Profile':     'Login User: ketwadee\nRole & Permission: All Permission - Contact Management',
  'Customer Appointment': 'Login User: ketwadee\nRole & Permission: All Permission - Appointment Management',
};

const norm = v => v == null ? '' :
  (typeof v === 'object'
    ? (Array.isArray(v) ? v.map(x => x.text ?? x).join('') : (v.text ?? v.value ?? ''))
    : String(v));

const token = await getAccessToken(cfg);

let pageToken = '', items = [];
do {
  const url = `${base}/open-apis/bitable/v1/apps/${APP}/tables/${TBL}/records?page_size=100${pageToken ? `&page_token=${pageToken}` : ''}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
  if (res.code !== 0) { console.error('ดึง records ไม่ได้:', res.msg); process.exit(1); }
  (res.data?.items || []).forEach(r => items.push(r));
  pageToken = res.data?.has_more ? res.data.page_token : '';
} while (pageToken);
console.log(`🗂️  Base: ${items.length} records`);

const updates = [];
const stat = {};
for (const r of items) {
  const feat = norm(r.fields?.['Feature']);
  const header = HEADER[feat];
  if (!header) continue;
  stat[feat] = stat[feat] || { total: 0, already: 0, update: 0 };
  stat[feat].total++;
  const cur = norm(r.fields?.[ARRANGE]);
  if (cur.startsWith('Login User:')) { stat[feat].already++; continue; }
  const next = `${header}\n${DIVIDER}\n${cur}`;
  updates.push({ record_id: r.record_id, tc: norm(r.fields?.['TC No.']), feat, fields: { [ARRANGE]: next } });
  stat[feat].update++;
}
console.log('สรุปต่อ Feature:', JSON.stringify(stat, null, 0));
console.log(`→ จะ update ทั้งหมด: ${updates.length} records`);

if (!CONFIRM) {
  console.log('\n=== DRY RUN (ยังไม่เขียน) === → ใส่ --confirm เพื่อเขียนจริง');
  updates.slice(0, 3).forEach(u => console.log(`   [${u.feat} / ${u.tc}] → ${JSON.stringify(u.fields[ARRANGE].slice(0, 60))}`));
  process.exit(0);
}

const BATCH = 10;
let ok = 0, fail = 0;
for (let i = 0; i < updates.length; i += BATCH) {
  const batch = updates.slice(i, i + BATCH);
  const records = batch.map(u => ({ record_id: u.record_id, fields: u.fields }));
  const res = await fetch(
    `${base}/open-apis/bitable/v1/apps/${APP}/tables/${TBL}/records/batch_update`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ records }) }
  ).then(r => r.json());
  if (res.code === 0) { ok += batch.length; batch.forEach(u => console.log(`  ✅ ${u.feat} / ${u.tc}`)); }
  else { fail += batch.length; console.error(`  ❌ batch ${i / BATCH + 1}:`, res.msg); }
}
console.log(`\n✅ Update เสร็จ: ${ok} · fail ${fail}`);
