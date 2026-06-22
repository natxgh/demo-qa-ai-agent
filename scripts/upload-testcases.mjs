// upload-testcases.mjs — อ่าน xlsx template (1 sheet) แล้ว upsert เข้า Lark Base
// Table: tblIwUWXkWNLYy4c (CC Super App — Test Scenarios & Result)
// รัน: node scripts/upload-testcases.mjs <path/to/testcases.xlsx> [--confirm]
//
// DRY-RUN by default · --confirm จึงส่งจริง
// upsert key: TC No. (ถ้ามีแถวนั้นอยู่แล้วจะ skip, ไม่ overwrite)

import fs from 'fs';
import path from 'path';
import { getAccessToken } from './lark-auth.mjs';

// ─── deps (openpyxl ไม่มีใน node → ใช้ exceljs) ──────────────────
// npm install exceljs  (ถ้ายังไม่มี)
let ExcelJS;
try {
  ExcelJS = (await import('exceljs')).default;
} catch {
  console.error('❌ ต้องติดตั้ง exceljs ก่อน: npm install exceljs');
  process.exit(1);
}

const ROOT    = process.cwd();
const CONFIRM = process.argv.includes('--confirm');
const xlsxArg = process.argv.find(a => a.endsWith('.xlsx'));

if (!xlsxArg) {
  console.error('Usage: node scripts/upload-testcases.mjs <path/to/testcases.xlsx> [--confirm]');
  process.exit(1);
}
const xlsxPath = path.isAbsolute(xlsxArg) ? xlsxArg : path.resolve(ROOT, xlsxArg);
if (!fs.existsSync(xlsxPath)) {
  console.error('ไม่พบไฟล์:', xlsxPath);
  process.exit(1);
}

// ─── config ────────────────────────────────────────────────────────
const cfgPath = path.join(ROOT, 'lark.config.json');
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const base       = (cfg.apiBase || 'https://open.larksuite.com').replace(/\/$/,'');
const APP_TOKEN  = process.env.TC_APP_TOKEN  || cfg.tcAppToken  || cfg.poAppToken;
const TABLE_ID   = process.env.TC_TABLE_ID   || cfg.tcTableId   || 'tblIwUWXkWNLYy4c';

// ─── อ่าน xlsx ─────────────────────────────────────────────────────
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(xlsxPath);

// หา sheet แรกที่ไม่ใช่ instruction sheet
const ws = wb.worksheets.find(s => s.name !== 'README' && s.name !== 'Instructions')
        || wb.worksheets[0];
console.log(`📂 Sheet: "${ws.name}"`);

// Header อยู่แถว 2 (แถว 1 = group label)
const headerRow = ws.getRow(2);
const headers = [];
headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
  headers[col] = String(cell.value || '').replace(/\n/g,' ').trim();
});

const colIdx = (name) => headers.findIndex(h => h && h.toLowerCase().startsWith(name.toLowerCase()));

// field mapping: xlsx column header → Lark Base field name
// (ตรวจสอบ/ปรับได้ถ้า header ใน xlsx ไม่ตรงกับ Base)
const FIELD_MAP = {
  'Project Name'              : 'Project Name',
  'Product'                   : 'Product',
  'Feature'                   : 'Feature',
  'Scenario No.'              : 'Scenario No.',
  'Scenario Name'             : 'Scenario Name',
  'Business Conditions'       : 'Business Conditions',
  'Arrange'                   : 'Arrange (สิ่งที่ต้องเตรียมก่อนการทดสอบ)',
  'TC No.'                    : 'TC No.',
  'Case Title Name'           : 'Case Title Name',
  'Test category'             : 'Test category',
  'Test Type'                 : 'Test Type',
  'Test Steps'                : 'Test Steps',
  'Data Test'                 : 'Data Test',
  'Expected Result'           : 'Expected Result',
};

// อ่านข้อมูลทุกแถว (ข้าม row 1-2 = group + header)
const rows = [];
ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
  if (rowNum <= 2) return;
  const rec = {};
  let hasData = false;
  for (const [xlsxName, larkName] of Object.entries(FIELD_MAP)) {
    const ci = colIdx(xlsxName);
    if (ci < 0) continue;
    const val = row.getCell(ci).value;
    const str = val == null ? '' : String(val).trim();
    if (str) { rec[larkName] = str; hasData = true; }
  }
  if (hasData && rec['TC No.']) rows.push(rec);
});

console.log(`📋 พบ ${rows.length} แถว (TC) ใน xlsx`);

// ─── DRY RUN ────────────────────────────────────────────────────────
if (!CONFIRM) {
  console.log('\n=== DRY RUN (ยังไม่ส่งเข้า Lark Base) ===');
  console.log('→ รัน --confirm เพื่อ upload จริง\n');
  console.log('ตัวอย่าง 3 แถวแรก:');
  rows.slice(0,3).forEach((r,i) => {
    console.log(`\n[${i+1}] TC No.: ${r['TC No.']} | Feature: ${r['Feature']} | Scenario: ${r['Scenario No.']}`);
    console.log(`     Title: ${r['Case Title Name']}`);
    console.log(`     Steps: ${String(r['Test Steps']||'').slice(0,60)}`);
  });
  console.log(`\nTarget: ${base}/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${TABLE_ID}`);
  process.exit(0);
}

// ─── UPLOAD ─────────────────────────────────────────────────────────
const token = await getAccessToken(cfg);

// ดึง record ที่มีอยู่แล้ว (เพื่อ skip duplicate)
// ⚠️ key = Feature + TC No. (composite) — Base รวมหลาย feature และ TC No. ซ้ำข้าม feature ได้
const norm = v => v == null ? '' : (typeof v === 'object' ? (Array.isArray(v) ? v.map(x => x.text ?? x).join('') : (v.text ?? v.value ?? '')) : String(v));
const keyOf = (feat, tc) => `${norm(feat).trim()}||${norm(tc).trim()}`;
let existingKeys = new Set();
try {
  let pageToken = '';
  do {
    const url = `${base}/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${TABLE_ID}/records?page_size=50${pageToken ? `&page_token=${pageToken}` : ''}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(r=>r.json());
    (res.data?.items||[]).forEach(r => {
      const tc = r.fields?.['TC No.'];
      if (tc) existingKeys.add(keyOf(r.fields?.['Feature'], tc));
    });
    pageToken = res.data?.has_more ? res.data.page_token : '';
  } while (pageToken);
  console.log(`→ มี ${existingKeys.size} (Feature+TC No.) อยู่แล้วใน Base (จะ skip)`);
} catch(e) {
  console.warn('⚠️ ดึง existing records ไม่ได้:', e.message);
}

// แบ่ง batch 10 แถว
const toUpload = rows.filter(r => !existingKeys.has(keyOf(r['Feature'], r['TC No.'])));
console.log(`→ จะ upload ${toUpload.length} แถว (skip ${rows.length - toUpload.length} ที่มีอยู่แล้ว)\n`);

// เตรียม select field options ก่อน upload
const selectFields = ['Project Name','Product','Feature','Test category','Test Type','Scenario No.'];
const fieldsRes = await fetch(
  `${base}/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${TABLE_ID}/fields?page_size=50`,
  { headers: { Authorization: `Bearer ${token}` } }
).then(r=>r.json());

for (const fname of selectFields) {
  const ff = fieldsRes.data?.items?.find(f => f.field_name === fname);
  if (!ff || (ff.type !== 3 && ff.type !== 4)) continue;
  const existingOpts = ff.property?.options || [];
  const existingNames = existingOpts.map(o => o.name);
  const newVals = [...new Set(toUpload.map(r => r[fname]).filter(Boolean))];
  const toAdd = newVals.filter(v => !existingNames.includes(v));
  if (toAdd.length > 0) {
    const allOptions = [...existingOpts, ...toAdd.map(name => ({ name }))];
    await fetch(
      `${base}/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${TABLE_ID}/fields/${ff.field_id}`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ field_name: fname, type: ff.type, property: { options: allOptions } }),
      }
    ).then(r=>r.json());
    console.log(`→ เพิ่ม option [${fname}]: ${toAdd.join(', ')}`);
  }
}

// batch create
const BATCH = 10;
let ok = 0, fail = 0;
for (let i = 0; i < toUpload.length; i += BATCH) {
  const batch = toUpload.slice(i, i + BATCH);
  const records = batch.map(r => ({ fields: r }));
  const res = await fetch(
    `${base}/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${TABLE_ID}/records/batch_create`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ records }),
    }
  ).then(r=>r.json());

  if (res.code === 0) {
    ok += res.data?.records?.length || batch.length;
    batch.forEach(r => console.log(`  ✅ ${r['TC No.']} — ${r['Case Title Name'] || ''}`));
  } else {
    fail += batch.length;
    console.error(`  ❌ batch ${i/BATCH+1} error:`, res.msg);
  }
}

console.log(`\n✅ Upload เสร็จ: ${ok} แถว · skip ${rows.length - toUpload.length} · fail ${fail}`);
