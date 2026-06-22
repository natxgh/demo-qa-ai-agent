// One-off: update Order Management records — Business Conditions (numbered list, no IDs)
// + Case Title Name (drop [xxx] prefix). Match by Feature + TC No. · batch_update by record_id.
// Usage: node scripts/update-order-bc-title.mjs [--confirm]
import fs from 'fs';
import { getAccessToken } from './lark-auth.mjs';

const CONFIRM = process.argv.includes('--confirm');
const cfg = JSON.parse(fs.readFileSync('lark.config.json', 'utf8'));
const base = cfg.apiBase.replace(/\/$/, '');
const FEATURE = 'Order Management';

// scenario No -> Business Conditions (numbered descriptive list)
const BC = {
  'TS-01':'1. Add to Cart (Spare Part / Product)\n2. Cart quantity (min 1, no max)\n3. Required fields (Bill To / Ship To / Ship By)\n4. Submit → Create Order\n5. Advance workflow step\n6. Event Notification',
  'TS-02':'1. List ↔ Grid view\n2. Table columns\n3. Order Detail elements\n4. Stock badge (In / Out of Stock)\n5. Comment (empty = No Comment)\n6. SLA Overdue badge\n7. Clear Filters',
  'TS-03':'1. Edit Bill / Shipping\n2. Edit Order Items\n3. Edit Title',
  'TS-04':'1. Add via Spare Part (Skip Product)\n2. Required fields (Bill To / Ship To / Ship By)\n3. Submit → Create Order',
  'TA-01':'1. Add to Cart\n2. Ship By required (blank → Submit blocked)',
  'TA-02':'1. Cart quantity lower boundary (min 1)\n2. Cancel before Approved → status Cancel',
  'TA-03':'1. Bill / Items locked after Submit\n2. Cancel blocked after Approved (BUG)',
  'TA-04':'1. Brand with no items → No results found',
  'TA-05':'1. Search by Order ID (no filter — BUG)\n2. Search by part name (no filter — BUG)',
  'TA-06':'1. Non-PIC user → Advance button hidden',
};

// TC No -> new Case Title Name (no [xxx] prefix)
const TITLE = {
  'TS-01_TC-01':'Add a product to Cart from Add Order',
  'TS-01_TC-02':'Increase Cart quantity to 2',
  'TS-01_TC-03':'Fill Bill To/Ship To/Ship By → Submit becomes enabled',
  'TS-01_TC-04':'Submit Order succeeds → new order created',
  'TS-01_TC-05':'Advance workflow: คำสั่งซื้อ → ส่งคำขอ',
  'TS-01_TC-06':'Advance workflow: Approved → Picking',
  'TS-01_TC-07':'Event Notification on workflow Advance',
  'TS-02_TC-01':'Toggle List ↔ Grid view',
  'TS-02_TC-02':'Table list shows all columns',
  'TS-02_TC-03':'Order Detail page renders all elements',
  'TS-02_TC-04':'Order Item shows Out of Stock badge',
  'TS-02_TC-05':'Chat box empty state = No Comment',
  'TS-02_TC-06':'Add a Comment to an order',
  'TS-02_TC-07':'Current step over SLA → Overdue badge',
  'TS-02_TC-08':'Clear Filters restores the full list',
  'TS-03_TC-01':'Edit Bill/Shipping inline then Save (Create Order)',
  'TS-03_TC-02':'Edit Order Item quantity (Create Order)',
  'TS-03_TC-03':'Edit the order Title',
  'TS-04_TC-01':'Add via Spare Part then Skip the Product step',
  'TS-04_TC-02':'Fill Bill To/Ship To/Ship By → Submit becomes enabled',
  'TS-04_TC-03':'Submit Order succeeds → new order created',
  'TA-01_TC-01':'Add a product to Cart from Add Order',
  'TA-01_TC-02':'Submit with Ship By left blank (required) → blocked',
  'TA-02_TC-01':'Decrease quantity below the minimum (lower boundary)',
  'TA-02_TC-02':'Cancel an order before Approved',
  'TA-03_TC-01':'After Submit — Bill & Items are locked',
  'TA-03_TC-02':'Cancel button at the Approved step should be blocked (BUG)',
  'TA-04_TC-01':'Select a brand with no items → No results',
  'TA-05_TC-01':'Search by Order ID (BUG: does not filter)',
  'TA-05_TC-02':'Search by part name (BUG: does not filter)',
  'TA-06_TC-01':'Non-PIC user → Advance button does not appear',
};

const norm = v => typeof v === 'string' ? v : (Array.isArray(v) ? v.map(x=>x.text||x.name||x).join('') : (v?.text || v?.[0]?.text || ''));

const token = await getAccessToken(cfg);
let items = [], pt = '';
do {
  const url = `${base}/open-apis/bitable/v1/apps/${cfg.tcAppToken}/tables/${cfg.tcTableId}/records?page_size=100${pt?`&page_token=${pt}`:''}`;
  const r = await fetch(url, { headers:{ Authorization:`Bearer ${token}` } }).then(x=>x.json());
  if (r.code !== 0) { console.error(JSON.stringify(r)); process.exit(1); }
  items.push(...(r.data?.items||[])); pt = r.data?.has_more ? r.data.page_token : '';
} while (pt);

const ord = items.filter(it => norm(it.fields.Feature) === FEATURE);
const updates = [];
for (const it of ord) {
  const tc = norm(it.fields['TC No.']);
  const sc = norm(it.fields['Scenario No.']);
  const newBC = BC[sc], newTitle = TITLE[tc];
  if (!newBC || !newTitle) { console.warn('⚠️ no mapping for', sc, tc); continue; }
  const curBC = norm(it.fields['Business Conditions']), curTitle = norm(it.fields['Case Title Name']);
  if (curBC === newBC && curTitle === newTitle) continue;
  updates.push({ record_id: it.record_id, fields: { 'Business Conditions': newBC, 'Case Title Name': newTitle }, tc });
}

console.log(`Feature ${FEATURE}: ${ord.length} records · ${updates.length} need update`);
for (const u of updates.slice(0,3)) console.log('  e.g.', u.tc, '→ title:', u.fields['Case Title Name']);

if (!CONFIRM) { console.log('\n=== DRY RUN === run with --confirm to write'); process.exit(0); }

for (let i=0; i<updates.length; i+=100) {
  const batch = updates.slice(i, i+100).map(u => ({ record_id:u.record_id, fields:u.fields }));
  const url = `${base}/open-apis/bitable/v1/apps/${cfg.tcAppToken}/tables/${cfg.tcTableId}/records/batch_update`;
  const r = await fetch(url, { method:'POST', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' }, body: JSON.stringify({ records: batch }) }).then(x=>x.json());
  if (r.code !== 0) { console.error('batch_update failed:', JSON.stringify(r)); process.exit(1); }
  console.log(`✅ updated ${batch.length} records`);
}
console.log('done');
