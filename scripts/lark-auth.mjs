// Lark auth helper — รองรับทั้ง tenant token และ user token (OAuth refresh)
// ใช้ร่วมโดย ask-po.mjs / poll-po.mjs / lark-oauth.mjs (ส่วน upload ผลย้ายไป global skill results-to-lark แล้ว)
// authMode ใน lark.config.json: "user" (default, ตามที่ admin กำหนด) | "tenant"
import fs from 'fs';
import path from 'path';

const TOKEN_FILE = path.join(process.cwd(), '.lark-token.json'); // gitignored

export function readToken() {
  return fs.existsSync(TOKEN_FILE) ? JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')) : null;
}
export function saveToken(obj) {
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(obj, null, 2));
}

/** app_access_token (ใช้เป็น header ตอนแลก/รีเฟรช user token) */
export async function appAccessToken(base, appId, appSecret) {
  const r = await fetch(`${base}/open-apis/auth/v3/app_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  }).then((x) => x.json());
  if (!r.app_access_token) throw new Error('app_access_token failed: ' + JSON.stringify(r));
  return r.app_access_token;
}

/**
 * คืน access token ที่ใช้เรียก API
 * - tenant mode: app_id/secret → tenant_access_token
 * - user mode:   refresh_token (.lark-token.json) → user access_token (refresh + persist token ที่หมุนใหม่)
 */
export async function getAccessToken(cfg) {
  const base = (cfg.apiBase || 'https://open.larksuite.com').replace(/\/$/, '');
  const { LARK_APP_ID, LARK_APP_SECRET } = process.env;
  const mode = cfg.authMode || 'user';

  if (mode === 'tenant') {
    const r = await fetch(`${base}/open-apis/auth/v3/tenant_access_token/internal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: LARK_APP_ID, app_secret: LARK_APP_SECRET }),
    }).then((x) => x.json());
    if (!r.tenant_access_token) throw new Error('tenant token failed: ' + JSON.stringify(r));
    return r.tenant_access_token;
  }

  // user mode
  const t = readToken();
  if (!t || !t.refresh_token) {
    throw new Error('ยังไม่มี refresh_token — รัน `npm run lark:oauth` (login + ยินยอม) ก่อน');
  }
  const appTok = await appAccessToken(base, LARK_APP_ID, LARK_APP_SECRET);
  // ⚠️ ยืนยัน endpoint กับ Docs ของแอป (international v1): /authen/v1/refresh_access_token
  const r = await fetch(`${base}/open-apis/authen/v1/refresh_access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${appTok}` },
    body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: t.refresh_token }),
  }).then((x) => x.json());
  const d = r.data || r;
  if (!d.access_token) throw new Error('refresh user token failed: ' + JSON.stringify(r));
  // เก็บ refresh_token ที่หมุนใหม่ (ถ้ามี)
  saveToken({ refresh_token: d.refresh_token || t.refresh_token, obtained_at: new Date().toISOString() });
  return d.access_token;
}
