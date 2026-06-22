// restore-feature.mjs — กู้ Feature field ของ records ที่ถูก bug option-ID ลบ
//
// ใช้เมื่อ: หลัง ask:po (version เก่า) records เก่า Feature column ว่างกะทันหัน
// วิธี: batch_update เฉพาะ field Feature อย่างเดียว — ไม่แตะ Answer
//
// ⚠️ ห้ามใช้ safeUpdateFields กู้! — bug มักเกิดหลัง PO ตอบแล้ว (มี Answer)
//    safeUpdateFields จะ skip ทุก record ที่ Answer ไม่ว่าง = กู้ไม่ได้สักตัว
//    การ restore Feature ที่ data-loss > การรักษา Modified By (exception เฉพาะ data-recovery)
//
// รัน:
//   node scripts/restore-feature.mjs              # dry-run
//   node scripts/restore-feature.mjs --confirm    # patch จริง
//
// records ที่ไม่อยู่ใน .po-loop/pending.json (ถามแยกทีหลัง) → ต้อง map เองใน MANUAL ด้านล่าง

import fs from 'fs';
import path from 'path';
import { getAccessToken } from './lark-auth.mjs';

const ROOT    = process.cwd();
const CONFIRM = process.argv.includes('--confirm');
const cfg     = JSON.parse(fs.readFileSync(path.join(ROOT, 'lark.config.json'), 'utf8'));
const base    = (cfg.apiBase || 'https://open.larksuite.com').replace(/\/$/, '');
const APP     = cfg.poAppToken;
const TBL     = cfg.poTableId;

// ── record_id → feature mapping จาก pending.json ────────────────
const fMap = {};
const pendingPath = path.join(ROOT, '.po-loop', 'pending.json');
if (fs.existsSync(pendingPath)) {
  const pending = JSON.parse(fs.readFileSync(pendingPath, 'utf8'));
  for (const b of pending) for (const r of b.records || []) {
    if (r.recordId) fMap[r.recordId] = b.feature;
  }
}
console.log(`pending.json: ${Object.keys(fMap).length} records mapped`);

// ── MANUAL: records ที่เพิ่มถามแยก (ไม่อยู่ใน pending.json) ──────
// เติม record_id → feature เองตามเนื้อหา Question  (ดู Q_ID/Question จาก dry-run output)
const MANUAL = {
  // 'recvXXXXXXXXXX': 'Customer Profile',
};
Object.assign(fMap, MANUAL);

const token = await getAccessToken(cfg);

// ── ดึง records ทั้งหมด ─────────────────────────────────────────
let all = [], pt = '';
do {
  const r = await fetch(
    `${base}/open-apis/bitable/v1/apps/${APP}/tables/${TBL}/records?page_size=100${pt ? `&page_token=${pt}` : ''}`,
    { headers: { Authorization: `Bearer ${token}` } }
  ).then((x) => x.json());
  all.push(...(r.data?.items || []));
  pt = r.data?.has_more ? r.data.page_token : '';
} while (pt);

const txt = (v) => v == null ? '' : (typeof v === 'object'
  ? (Array.isArray(v) ? v.map((x) => x.text ?? x.name ?? x).join('') : (v.text ?? v.value ?? ''))
  : String(v));
const isEmpty = (f) => !f || (Array.isArray(f) && f.length === 0) || f === '';

const emptyAll = all.filter((it) => isEmpty(it.fields?.Feature));
const toFix    = emptyAll.filter((it) => fMap[it.record_id]);
const noMap    = emptyAll.filter((it) => !fMap[it.record_id]);

console.log(`Base: ${all.length} records · Feature ว่าง ${emptyAll.length} · กู้ได้ ${toFix.length}`);
toFix.forEach((it) => console.log(`  ${it.record_id} → "${fMap[it.record_id]}"`));
if (noMap.length) {
  console.log(`\n⚠️ ${noMap.length} records Feature ว่างแต่ไม่มี mapping — เติมใน MANUAL ตามเนื้อหา:`);
  noMap.forEach((it) => console.log(`  ${it.record_id}  Q="${txt(it.fields?.Question).slice(0, 60)}"`));
}

if (!CONFIRM) {
  console.log('\n=== DRY RUN — เพิ่ม --confirm เพื่อ patch จริง ===');
  process.exit(0);
}

// ── batch_update ทีละ 10 — Feature only ─────────────────────────
const BATCH = 10;
let ok = 0, fail = 0;
for (let i = 0; i < toFix.length; i += BATCH) {
  const chunk = toFix.slice(i, i + BATCH);
  const records = chunk.map((it) => ({ record_id: it.record_id, fields: { Feature: [fMap[it.record_id]] } }));
  const res = await fetch(
    `${base}/open-apis/bitable/v1/apps/${APP}/tables/${TBL}/records/batch_update`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ records }) }
  ).then((x) => x.json());
  if (res.code === 0) { ok += chunk.length; chunk.forEach((r) => console.log(`  ✅ ${r.record_id} → "${fMap[r.record_id]}"`)); }
  else { fail += chunk.length; console.error(`  ❌ batch error: ${res.msg}`); }
}
console.log(`\nDone: ${ok} patched · ${fail} fail${noMap.length ? ` · ${noMap.length} ยังไม่มี mapping (ดู MANUAL)` : ''}`);
