// One-off: delete all Order Management records (design-only, no test results yet) so we can
// re-insert a clean consistent set. Usage: node scripts/delete-order-records.mjs [--confirm]
import fs from 'fs';
import { getAccessToken } from './lark-auth.mjs';

const CONFIRM = process.argv.includes('--confirm');
const cfg = JSON.parse(fs.readFileSync('lark.config.json', 'utf8'));
const base = cfg.apiBase.replace(/\/$/, '');
const FEATURE = 'Order Management';
const norm = v => typeof v === 'string' ? v : (Array.isArray(v) ? v.map(x=>x.text||x.name||x).join('') : (v?.text || v?.[0]?.text || ''));

const token = await getAccessToken(cfg);
let items = [], pt = '';
do {
  const url = `${base}/open-apis/bitable/v1/apps/${cfg.tcAppToken}/tables/${cfg.tcTableId}/records?page_size=100${pt?`&page_token=${pt}`:''}`;
  const r = await fetch(url, { headers:{ Authorization:`Bearer ${token}` } }).then(x=>x.json());
  if (r.code !== 0) { console.error(JSON.stringify(r)); process.exit(1); }
  items.push(...(r.data?.items||[])); pt = r.data?.has_more ? r.data.page_token : '';
} while (pt);

// safety: only delete records with NO test result captured
const ord = items.filter(it => norm(it.fields.Feature) === FEATURE);
const withResult = ord.filter(it => norm(it.fields['Test Result']));
console.log(`Feature ${FEATURE}: ${ord.length} records · ${withResult.length} have a Test Result (will be SKIPPED for safety)`);
const ids = ord.filter(it => !norm(it.fields['Test Result'])).map(it => it.record_id);
console.log(`To delete: ${ids.length}`);

if (!CONFIRM) { console.log('\n=== DRY RUN === run with --confirm to delete'); process.exit(0); }

for (let i=0; i<ids.length; i+=100) {
  const batch = ids.slice(i, i+100);
  const url = `${base}/open-apis/bitable/v1/apps/${cfg.tcAppToken}/tables/${cfg.tcTableId}/records/batch_delete`;
  const r = await fetch(url, { method:'POST', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' }, body: JSON.stringify({ records: batch }) }).then(x=>x.json());
  if (r.code !== 0) { console.error('batch_delete failed:', JSON.stringify(r)); process.exit(1); }
  console.log(`✅ deleted ${batch.length}`);
}
console.log('done');
