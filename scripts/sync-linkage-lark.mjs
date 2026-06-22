#!/usr/bin/env node
// Sync Linkage Customer Profile with Case design (EN) → Lark Base (update existing records by Feature+TC No.)
// DRY-RUN by default · --confirm writes. Source = regenerated xlsx snapshot.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAccessToken } from './lark-auth.mjs';
import ExcelJS from 'exceljs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIRM = process.argv.includes('--confirm');
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'lark.config.json'), 'utf8'));
const base = cfg.apiBase, APP = cfg.tcAppToken, TBL = cfg.tcTableId;
const FEATURE = 'Linkage Customer Profile with Case';
const XLSX = '/Users/ketwadee.kae/Documents/WorkSpace/CC Super App/10-Linkage Customer Profile with Case/linkage-customer-case-testcases.xlsx';
const ARRANGE = 'Arrange (สิ่งที่ต้องเตรียมก่อนการทดสอบ)';

const norm = v => v == null ? '' :
  (typeof v === 'object'
    ? (v.richText ? v.richText.map(t => t.text).join('') : Array.isArray(v) ? v.map(x => x.text ?? x).join('') : (v.text ?? v.value ?? ''))
    : String(v));

// --- read xlsx (header row 2, data row 3+) ---
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(XLSX);
const ws = wb.worksheets[0];
const hdr = ws.getRow(2).values.slice(1);
const col = n => hdr.indexOf(n) + 1;
const FIELDS = ['Scenario No.','Scenario Name','Business Conditions','TC No.','Case Title Name','Test category','Test Type','Test Steps','Data Test','Expected Result'];
const ARR_XLSX = hdr.find(h => String(h).startsWith('Arrange'));
const byTc = {};
for (let r = 3; r <= ws.rowCount; r++) {
  const row = ws.getRow(r);
  const get = n => norm(row.getCell(col(n)).value);
  const tc = get('TC No.');
  if (!tc) continue;
  const fields = {};
  for (const f of FIELDS) fields[f] = get(f);
  fields[ARRANGE] = norm(row.getCell(col(ARR_XLSX)).value);
  byTc[tc] = fields;
}
console.log(`📄 xlsx: ${Object.keys(byTc).length} TCs`);

// --- fetch Base records for this feature ---
const token = await getAccessToken(cfg);
let pageToken = '', items = [];
do {
  const url = `${base}/open-apis/bitable/v1/apps/${APP}/tables/${TBL}/records?page_size=100${pageToken ? `&page_token=${pageToken}` : ''}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
  if (res.code !== 0) { console.error('fetch failed:', res.msg); process.exit(1); }
  (res.data?.items || []).forEach(r => items.push(r));
  pageToken = res.data?.has_more ? res.data.page_token : '';
} while (pageToken);
const featRecords = items.filter(r => norm(r.fields?.['Feature']) === FEATURE);
console.log(`🗂️  Base: ${items.length} total · ${featRecords.length} for "${FEATURE}"`);

const baseByTc = {};
for (const r of featRecords) baseByTc[norm(r.fields?.['TC No.'])] = r;

// --- build updates / detect missing ---
const updates = [], missing = [];
for (const [tc, fields] of Object.entries(byTc)) {
  const rec = baseByTc[tc];
  if (!rec) { missing.push(tc); continue; }
  const changed = {};
  for (const [k, v] of Object.entries(fields)) {
    if (k === 'TC No.') continue;
    if (norm(rec.fields?.[k]) !== v) changed[k] = v;
  }
  if (Object.keys(changed).length) updates.push({ record_id: rec.record_id, tc, changed });
}
const orphan = Object.keys(baseByTc).filter(tc => !byTc[tc]);

console.log(`\n→ update: ${updates.length} records · insert(missing on Base): ${missing.length} · orphan on Base (not in xlsx): ${orphan.length}`);
if (missing.length) console.log('   missing TCs:', missing.join(', '));
if (orphan.length) console.log('   orphan TCs:', orphan.join(', '));
console.log('\n   changed-field summary:');
updates.forEach(u => console.log(`   [${u.tc}] ${Object.keys(u.changed).join(', ')}`));

if (!CONFIRM) {
  console.log('\n=== DRY RUN (no write) === → add --confirm to write');
  if (updates[0]) console.log('\n   sample:', updates[0].tc, '\n   ', JSON.stringify(updates[0].changed).slice(0, 400));
  process.exit(0);
}

// --- insert missing first ---
if (missing.length) {
  const records = missing.map(tc => ({ fields: { 'Project Name':'AICC','Product':'CC Super App','Feature':FEATURE, ...byTc[tc] } }));
  const res = await fetch(`${base}/open-apis/bitable/v1/apps/${APP}/tables/${TBL}/records/batch_create`,
    { method:'POST', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' }, body: JSON.stringify({ records }) }).then(r => r.json());
  console.log(res.code === 0 ? `  ➕ inserted ${missing.length}` : `  ❌ insert failed: ${res.msg}`);
}

// --- batch update ---
const BATCH = 10; let ok = 0, fail = 0;
for (let i = 0; i < updates.length; i += BATCH) {
  const batch = updates.slice(i, i + BATCH);
  const records = batch.map(u => ({ record_id: u.record_id, fields: u.changed }));
  const res = await fetch(`${base}/open-apis/bitable/v1/apps/${APP}/tables/${TBL}/records/batch_update`,
    { method:'POST', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' }, body: JSON.stringify({ records }) }).then(r => r.json());
  if (res.code === 0) { ok += batch.length; batch.forEach(u => console.log(`  ✅ ${u.tc}`)); }
  else { fail += batch.length; console.error(`  ❌ batch ${i/BATCH+1}:`, res.msg); }
}
console.log(`\n✅ update done: ${ok} · fail ${fail}`);
