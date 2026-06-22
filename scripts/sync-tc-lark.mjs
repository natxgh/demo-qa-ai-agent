// sync-tc-lark.mjs — update existing Test Scenario rows in Lark Base by (Feature + TC No.)
// Updates ONLY design fields (leaves Test Result / Defect columns untouched). Inserts new TCs.
// DRY-RUN by default · --confirm to write.
// Usage: node scripts/sync-tc-lark.mjs <path/to/testcases.xlsx> [--confirm]
import fs from 'fs';
import path from 'path';
import { getAccessToken } from './lark-auth.mjs';
import ExcelJS from 'exceljs';

const ROOT = process.cwd();
const CONFIRM = process.argv.includes('--confirm');
const xlsxArg = process.argv.find(a => a.endsWith('.xlsx'));
if (!xlsxArg) { console.error('Usage: node scripts/sync-tc-lark.mjs <xlsx> [--confirm]'); process.exit(1); }
const xlsxPath = path.isAbsolute(xlsxArg) ? xlsxArg : path.resolve(ROOT, xlsxArg);

const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'lark.config.json'), 'utf8'));
const base = (cfg.apiBase || 'https://open.larksuite.com').replace(/\/$/, '');
const APP = cfg.tcAppToken;
const TABLE = cfg.tcTableId || 'tblIwUWXkWNLYy4c';

const FIELD_MAP = {
  'Project Name':'Project Name','Product':'Product','Feature':'Feature',
  'Scenario No.':'Scenario No.','Scenario Name':'Scenario Name','Business Conditions':'Business Conditions',
  'Arrange':'Arrange (สิ่งที่ต้องเตรียมก่อนการทดสอบ)','TC No.':'TC No.','Case Title Name':'Case Title Name',
  'Test category':'Test category','Test Type':'Test Type','Test Steps':'Test Steps',
  'Data Test':'Data Test','Expected Result':'Expected Result',
};

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(xlsxPath);
const ws = wb.worksheets[0];
const headers = [];
ws.getRow(2).eachCell({ includeEmpty:false }, (c,col)=>{ headers[col]=String(c.value||'').replace(/\n/g,' ').trim(); });
const colIdx = (n)=>headers.findIndex(h=>h && h.toLowerCase().startsWith(n.toLowerCase()));

const rows = [];
ws.eachRow({ includeEmpty:false }, (row,rn)=>{
  if (rn<=2) return;
  const rec={}; let has=false;
  for (const [x,l] of Object.entries(FIELD_MAP)){
    const ci=colIdx(x); if(ci<0) continue;
    const v=row.getCell(ci).value; const s=v==null?'':String(v).trim();
    if(s){ rec[l]=s; has=true; }
  }
  if(has && rec['TC No.']) rows.push(rec);
});
const FEATURE = rows[0]?.['Feature'];
console.log(`📋 xlsx rows: ${rows.length} · Feature: ${FEATURE}`);

const token = await getAccessToken(cfg);
const norm = v => v==null?'':(typeof v==='object'?(Array.isArray(v)?v.map(x=>x.text??x).join(''):(v.text??v.value??'')):String(v));
const keyOf=(f,tc)=>`${norm(f).trim()}||${norm(tc).trim()}`;

// fetch existing records for this Feature
const existing = new Map(); // key -> {record_id, fields}
let pt='';
do {
  const url=`${base}/open-apis/bitable/v1/apps/${APP}/tables/${TABLE}/records?page_size=100${pt?`&page_token=${pt}`:''}`;
  const r=await fetch(url,{headers:{Authorization:`Bearer ${token}`}}).then(x=>x.json());
  if(r.code!==0){ console.error('fetch fail',JSON.stringify(r)); process.exit(1); }
  for(const it of r.data?.items||[]){
    const tc=it.fields?.['TC No.']; if(!tc) continue;
    existing.set(keyOf(it.fields?.['Feature'],tc),{record_id:it.record_id,fields:it.fields});
  }
  pt=r.data?.has_more?r.data.page_token:'';
}while(pt);
const featExisting=[...existing.keys()].filter(k=>k.startsWith(`${FEATURE}||`)).length;
console.log(`→ existing rows in Base for "${FEATURE}": ${featExisting}`);

const newKeys=new Set(rows.map(r=>keyOf(r['Feature'],r['TC No.'])));
const updates=[], inserts=[], changed=[];
for(const r of rows){
  const k=keyOf(r['Feature'],r['TC No.']);
  const ex=existing.get(k);
  if(ex){
    // diff: which fields differ
    const diff={};
    for(const [,l] of Object.entries(FIELD_MAP)){
      if(r[l]!=null && norm(ex.fields?.[l]).trim()!==String(r[l]).trim()) diff[l]=r[l];
    }
    if(Object.keys(diff).length){ updates.push({record_id:ex.record_id, fields:r}); changed.push({tc:r['TC No.'], fields:Object.keys(diff)}); }
  } else inserts.push({fields:r});
}
// stale = records for THIS feature in Base whose key is not in the new xlsx set
const stale=[];
for(const [k,ex] of existing){
  if(k.startsWith(`${FEATURE}||`) && !newKeys.has(k)) stale.push({record_id:ex.record_id, tc:norm(ex.fields?.['TC No.'])});
}
console.log(`\n=== PLAN ===`);
console.log(`UPDATE: ${updates.length}  ·  INSERT: ${inserts.length}  ·  DELETE(stale): ${stale.length}  ·  unchanged: ${rows.length-updates.length-inserts.length}`);
console.log(`\nSample changed fields (first 6):`);
changed.slice(0,6).forEach(c=>console.log(`  ${c.tc}: ${c.fields.join(', ')}`));
if(inserts.length) console.log(`\nInserts: ${inserts.map(i=>i.fields['TC No.']).join(', ')}`);
if(stale.length) console.log(`\nStale (will DELETE): ${stale.map(s=>s.tc).join(', ')}`);

if(!CONFIRM){ console.log('\n=== DRY RUN — rerun with --confirm to write ==='); process.exit(0); }

// ensure select options exist
const selectFields=['Project Name','Product','Feature','Test category','Test Type','Scenario No.'];
const fieldsRes=await fetch(`${base}/open-apis/bitable/v1/apps/${APP}/tables/${TABLE}/fields?page_size=100`,{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json());
for(const fname of selectFields){
  const ff=fieldsRes.data?.items?.find(f=>f.field_name===fname);
  if(!ff||(ff.type!==3&&ff.type!==4)) continue;
  const opts=ff.property?.options||[]; const names=opts.map(o=>o.name);
  const vals=[...new Set(rows.map(r=>r[fname]).filter(Boolean))];
  const add=vals.filter(v=>!names.includes(v));
  if(add.length){
    await fetch(`${base}/open-apis/bitable/v1/apps/${APP}/tables/${TABLE}/fields/${ff.field_id}`,{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({field_name:fname,type:ff.type,property:{options:[...opts,...add.map(name=>({name}))]}})}).then(r=>r.json());
    console.log(`→ added options [${fname}]: ${add.join(', ')}`);
  }
}

const chunk=(a,n)=>a.reduce((o,_,i)=>(i%n?o:[...o,a.slice(i,i+n)]),[]);
let uOK=0,iOK=0;
for(const b of chunk(updates,10)){
  const r=await fetch(`${base}/open-apis/bitable/v1/apps/${APP}/tables/${TABLE}/records/batch_update`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({records:b})}).then(x=>x.json());
  if(r.code===0){ uOK+=b.length; } else console.error('update fail:',r.msg);
}
for(const b of chunk(inserts,10)){
  const r=await fetch(`${base}/open-apis/bitable/v1/apps/${APP}/tables/${TABLE}/records/batch_create`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({records:b})}).then(x=>x.json());
  if(r.code===0){ iOK+=b.length; } else console.error('insert fail:',r.msg);
}
let dOK=0;
for(const b of chunk(stale.map(s=>s.record_id),10)){
  const r=await fetch(`${base}/open-apis/bitable/v1/apps/${APP}/tables/${TABLE}/records/batch_delete`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({records:b})}).then(x=>x.json());
  if(r.code===0){ dOK+=b.length; } else console.error('delete fail:',r.msg);
}
console.log(`\n✅ updated ${uOK} · inserted ${iOK} · deleted ${dOK}`);
