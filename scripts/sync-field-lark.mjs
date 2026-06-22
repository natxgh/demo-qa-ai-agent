#!/usr/bin/env node
// Sync ค่าจาก xlsx → field ใน Lark Base ของ record ที่มีอยู่ (match Feature + TC No., update ทีละ record_id)
// รัน: node scripts/sync-field-lark.mjs <xlsx> "<Feature>" "<Field name in Base>" [--confirm]
// DRY-RUN by default · --confirm จึงเขียนจริง
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import { getAccessToken } from './lark-auth.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIRM = process.argv.includes('--confirm');
const args = process.argv.slice(2).filter(a => a !== '--confirm');
const [xlsxArg, FEATURE, FIELD] = args;
if (!xlsxArg || !FEATURE || !FIELD) {
  console.error('Usage: node scripts/sync-field-lark.mjs <xlsx> "<Feature>" "<Field>" [--confirm]');
  process.exit(1);
}
const xlsxPath = path.resolve(xlsxArg);
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'lark.config.json'), 'utf8'));
const base = cfg.apiBase, APP = cfg.tcAppToken, TBL = cfg.tcTableId;
const norm = v => v == null ? '' : (typeof v === 'object' ? (Array.isArray(v) ? v.map(x => x.text ?? x).join('') : (v.text ?? v.value ?? '')) : String(v));

// ── read xlsx → TC No. → field value ──
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(xlsxPath);
const ws = wb.worksheets.find(s => s.name !== 'README' && s.name !== 'Instructions') || wb.worksheets[0];
const headers = [];
ws.getRow(2).eachCell({ includeEmpty: false }, (c, col) => { headers[col] = String(c.value || '').replace(/\n/g, ' ').trim(); });
const colOf = name => headers.findIndex(h => h && h.toLowerCase().startsWith(name.toLowerCase()));
const tcCol = colOf('TC No.'), fCol = colOf(FIELD);
if (tcCol < 0 || fCol < 0) { console.error(`หา column "TC No." หรือ "${FIELD}" ใน xlsx ไม่เจอ (headers: ${headers.filter(Boolean).join(' | ')})`); process.exit(1); }
const want = new Map();
ws.eachRow({ includeEmpty: false }, (row, n) => {
  if (n <= 2) return;
  const tc = norm(row.getCell(tcCol).value).trim();
  const val = norm(row.getCell(fCol).value);
  if (tc && val.trim() !== '') want.set(tc, val); // ข้าม cell ว่าง — ไม่ทับค่าใน Base ด้วยค่าว่าง
});
console.log(`📋 xlsx: ${want.size} TC · field "${FIELD}"`);

// ── fetch Base records for this Feature ──
const token = await getAccessToken(cfg);
const existing = new Map();
let pageToken = '';
do {
  const url = `${base}/open-apis/bitable/v1/apps/${APP}/tables/${TBL}/records?page_size=100${pageToken ? `&page_token=${pageToken}` : ''}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
  if (res.code !== 0) { console.error('ดึง records ไม่ได้:', res.msg); process.exit(1); }
  (res.data?.items || []).forEach(r => {
    if (norm(r.fields?.['Feature']) !== FEATURE) return;
    const tc = norm(r.fields?.['TC No.']).trim();
    if (tc) existing.set(tc, { record_id: r.record_id, val: norm(r.fields?.[FIELD]) });
  });
  pageToken = res.data?.has_more ? res.data.page_token : '';
} while (pageToken);
console.log(`🗂️  Base (${FEATURE}): ${existing.size} records`);

// ── diff ──
const updates = [], missing = [];
for (const [tc, newVal] of want) {
  const ex = existing.get(tc);
  if (!ex) { missing.push(tc); continue; }
  if (ex.val.trim() !== newVal.trim()) updates.push({ record_id: ex.record_id, tc, old: ex.val, fields: { [FIELD]: newVal } });
}
console.log(`→ ต่าง (จะ update): ${updates.length} · เหมือนเดิม: ${want.size - updates.length - missing.length} · ไม่เจอใน Base: ${missing.length}`);
if (missing.length) console.log('   ⚠️ ไม่เจอ:', missing.join(', '));

if (!CONFIRM) {
  console.log('\n=== DRY RUN === → ใส่ --confirm เพื่อเขียนจริง');
  updates.slice(0, 2).forEach(u => {
    console.log(`\n[${u.tc}]\n  OLD: ${JSON.stringify(u.old.slice(0, 80))}\n  NEW: ${JSON.stringify(u.fields[FIELD].slice(0, 80))}`);
  });
  process.exit(0);
}

const BATCH = 10;
let ok = 0, fail = 0;
for (let i = 0; i < updates.length; i += BATCH) {
  const batch = updates.slice(i, i + BATCH);
  const res = await fetch(
    `${base}/open-apis/bitable/v1/apps/${APP}/tables/${TBL}/records/batch_update`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ records: batch.map(u => ({ record_id: u.record_id, fields: u.fields })) }) }
  ).then(r => r.json());
  if (res.code === 0) { ok += batch.length; batch.forEach(u => console.log(`  ✅ ${u.tc}`)); }
  else { fail += batch.length; console.error(`  ❌ batch ${i / BATCH + 1}:`, res.msg); }
}
console.log(`\n✅ เสร็จ: ${ok} · fail ${fail}`);
