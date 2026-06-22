// One-time OAuth — ขอ user authorization → เก็บ refresh_token ลง .lark-token.json (gitignored)
// รัน: npm run lark:oauth   (ต้องตั้ง env LARK_APP_ID / LARK_APP_SECRET + lark.config.json มี redirectUri)
// ทำครั้งเดียว/ต่อผู้ใช้; หลังจากนั้น file-to-lark.mjs จะ refresh เอง
import http from 'http';
import fs from 'fs';
import path from 'path';
import { appAccessToken, saveToken } from './lark-auth.mjs';

const ROOT = process.cwd();
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'lark.config.json'), 'utf8'));
const base = (cfg.apiBase || 'https://open.larksuite.com').replace(/\/$/, '');
const { LARK_APP_ID, LARK_APP_SECRET } = process.env;
if (!LARK_APP_ID || !LARK_APP_SECRET) {
  console.error('ตั้ง env LARK_APP_ID และ LARK_APP_SECRET ก่อน');
  process.exit(1);
}
const redirect = cfg.redirectUri || 'http://localhost:3000/callback';
const u = new URL(redirect);
const port = Number(u.port || 3000);
const state = Math.random().toString(36).slice(2);

// ⚠️ ยืนยัน path authorize กับ Docs ของแอป (international v1): /authen/v1/index
const authUrl =
  `${base}/open-apis/authen/v1/index?app_id=${LARK_APP_ID}` +
  `&redirect_uri=${encodeURIComponent(redirect)}&state=${state}`;

console.log('\n=== Lark OAuth (user token) ===');
console.log('1) เปิดลิงก์นี้ในเบราว์เซอร์ → login + กดยินยอม:\n');
console.log('   ' + authUrl + '\n');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, redirect);
  if (url.pathname !== u.pathname) {
    res.writeHead(404);
    return res.end();
  }
  const code = url.searchParams.get('code');
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<h2>✅ รับ code แล้ว — ปิดหน้านี้ได้เลย</h2>');
  try {
    const appTok = await appAccessToken(base, LARK_APP_ID, LARK_APP_SECRET);
    // ⚠️ ยืนยัน endpoint: /authen/v1/access_token (แลก code → user token)
    const r = await fetch(`${base}/open-apis/authen/v1/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${appTok}` },
      body: JSON.stringify({ grant_type: 'authorization_code', code }),
    }).then((x) => x.json());
    const d = r.data || r;
    if (!d.refresh_token) {
      console.error('❌ แลก token ไม่สำเร็จ:', JSON.stringify(r));
      process.exit(1);
    }
    saveToken({ refresh_token: d.refresh_token, obtained_at: new Date().toISOString() });
    console.log('✅ เก็บ refresh_token → .lark-token.json (gitignored) เรียบร้อย');
    console.log('   พร้อมใช้: npm run file:lark -- --confirm');
  } catch (e) {
    console.error('❌', e.message);
  } finally {
    server.close();
    process.exit(0);
  }
});
server.listen(port, () => console.log(`2) รอ callback ที่ ${redirect} ...`));
