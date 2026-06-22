// gen-testcases.mjs — สร้าง hrms-login-testcases.xlsx (new 1-sheet format)
// รัน: node gen-testcases.mjs
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE = '/Users/ketwadee.kae/Documents/WorkSpace/qa-ai-pilot/templates/testcases-template.xlsx';
const OUT = path.join(__dir, 'hrms-login-testcases.xlsx');

let ExcelJS;
try { ExcelJS = (await import('exceljs')).default; }
catch { console.error('npm install exceljs'); process.exit(1); }

// ─── Data ─────────────────────────────────────────────────────────────────────
const PROJECT = 'HRMS';
const PRODUCT = 'HRMS';
const FEATURE = 'Login';

// Arrange shared strings
const ARR_CLEAR  = 'Browser state: clear cookie/session (incognito) · บัญชี ketwadee.kae ใน Org "SKY AI" มีอยู่ใน SIT';
const ARR_TS01   = ARR_CLEAR;
const ARR_TS02   = 'Browser state: clear cookie/session (incognito) · บัญชี ketwadee.kae ใน Org "SKY AI" มีอยู่ใน SIT · ยังไม่เคยล็อกอิน Remember me';
const ARR_TS03   = 'มีบัญชี Lark ที่ผูกกับ HRMS + มีสิทธิ์เข้า HRMS (Sit) · Browser state: clear';
const ARR_TS04   = 'เปิดหน้า Login แล้ว · กรอก Password field ด้วย Kae@2024!';
const ARR_TA01   = 'Browser state: clear · บัญชี ketwadee.kae มีอยู่ใน Org "SKY AI" · รหัส WrongPass9 ไม่ใช่รหัสจริง';
const ARR_TA02   = 'Browser state: clear · Org "SKY AI" ไม่มี username "napat.cha" ในระบบ';
const ARR_TA03   = 'Browser state: clear · เปิดหน้า Login ไม่เลือก Organization';
const ARR_TA04   = 'Browser state: clear · เปิดหน้า Login ไม่กรอกข้อมูลใดเลย';
const ARR_TA05   = 'มีบัญชี Lark ที่ไม่ได้รับสิทธิ์เข้า HRMS (Sit)';
const ARR_TA06   = 'Browser state: clear · บัญชี ketwadee.kae มีอยู่ใน Org "SKY AI"';
const ARR_SEC01  = 'Browser state: clear · บัญชี ketwadee.kae มีอยู่ใน Org "SKY AI"';

// rows: [Project, Product, Feature, ScenarioNo, ScenarioName, BusinessConditions, Arrange, TCNo, CaseTitle, TestCategory, TestType, TestSteps, DataTest, ExpectedResult]
const rows = [
  // TS-01
  [PROJECT,PRODUCT,FEATURE,'TS-01','ล็อกอินสำเร็จด้วย Username/Password','LG1 (Org required), LG2 (Username valid), LG3 (Password match), LG4 (required fields), LG7 (redirect)',
   ARR_TS01,'TS-01_TC-01','เปิดหน้า Login','POSITIVE','SYSTEMTEST',
   'เปิด URL /login?go=/dashboard ใน incognito browser',
   'https://frontend-v2.hrms-sit.skyai.co.th/login?go=/dashboard',
   'หน้า Login โหลดสำเร็จ · แสดง Organization dropdown (placeholder "Select Organization"), Username field (ว่าง), Password field (ว่าง), checkbox "Remember me" (✅ checked), ปุ่ม "Log in" (สีน้ำเงิน), ปุ่ม "Login With Lark Account" (สีดำ) · URL = /login?go=/dashboard'],

  [PROJECT,PRODUCT,FEATURE,'TS-01','ล็อกอินสำเร็จด้วย Username/Password','LG1 (Org required), LG2 (Username valid), LG3 (Password match), LG4 (required fields), LG7 (redirect)',
   ARR_TS01,'TS-01_TC-02','เลือก Organization','POSITIVE','SYSTEMTEST',
   'คลิก dropdown Organization → เลือก "SKY AI"',
   'Organization = SKY AI',
   'Organization dropdown แสดงค่า "SKY AI" · dropdown ปิดกลับเป็นปกติ'],

  [PROJECT,PRODUCT,FEATURE,'TS-01','ล็อกอินสำเร็จด้วย Username/Password','LG1 (Org required), LG2 (Username valid), LG3 (Password match), LG4 (required fields), LG7 (redirect)',
   ARR_TS01,'TS-01_TC-03','กรอก Username','POSITIVE','SYSTEMTEST',
   'คลิก Username field แล้วพิมพ์ username',
   'ketwadee.kae',
   'Username field แสดงข้อความ "ketwadee.kae"'],

  [PROJECT,PRODUCT,FEATURE,'TS-01','ล็อกอินสำเร็จด้วย Username/Password','LG1 (Org required), LG2 (Username valid), LG3 (Password match), LG4 (required fields), LG7 (redirect)',
   ARR_TS01,'TS-01_TC-04','กรอก Password','POSITIVE','SYSTEMTEST',
   'คลิก Password field แล้วพิมพ์ password',
   'Kae@2024!',
   'Password field แสดงเป็น mask "••••••••" (8 จุด) · icon eye-off อยู่ทางขวา'],

  [PROJECT,PRODUCT,FEATURE,'TS-01','ล็อกอินสำเร็จด้วย Username/Password','LG1 (Org required), LG2 (Username valid), LG3 (Password match), LG4 (required fields), LG7 (redirect)',
   ARR_TS01,'TS-01_TC-05','กดปุ่ม Log in','POSITIVE','SYSTEMTEST',
   'กดปุ่ม "Log in"',
   '-',
   'ล็อกอินสำเร็จ · browser redirect ไป /dashboard · แสดงหน้า Dashboard ของ HRMS · ไม่แสดงหน้า Login อีก'],

  // TS-02
  [PROJECT,PRODUCT,FEATURE,'TS-02','ล็อกอินสำเร็จ + Remember me คงสถานะ','LG1, LG2, LG3, LG4, LG6 (Remember me)',
   ARR_TS02,'TS-02_TC-01','เปิดหน้า Login','POSITIVE','SYSTEMTEST',
   'เปิด /login?go=/dashboard ใน incognito browser',
   'https://frontend-v2.hrms-sit.skyai.co.th/login?go=/dashboard',
   'แสดงหน้า Login พร้อม checkbox "Remember me" (✅ checked ค่าเริ่มต้น)'],

  [PROJECT,PRODUCT,FEATURE,'TS-02','ล็อกอินสำเร็จ + Remember me คงสถานะ','LG1, LG2, LG3, LG4, LG6 (Remember me)',
   ARR_TS02,'TS-02_TC-02','เลือก Org + กรอก credentials','POSITIVE','SYSTEMTEST',
   'เลือก Org "SKY AI" · กรอก Username · กรอก Password',
   'Org = SKY AI · Username = ketwadee.kae · Password = Kae@2024!',
   'ทั้ง 3 field มีค่าครบ ไม่มี error required'],

  [PROJECT,PRODUCT,FEATURE,'TS-02','ล็อกอินสำเร็จ + Remember me คงสถานะ','LG1, LG2, LG3, LG4, LG6 (Remember me)',
   ARR_TS02,'TS-02_TC-03','ตรวจ Remember me checked','POSITIVE','SYSTEMTEST',
   'ดู checkbox "Remember me"',
   'Remember me = ✅ checked',
   'checkbox "Remember me" มีเครื่องหมาย ✅ checked (ค่าเริ่มต้นของระบบ)'],

  [PROJECT,PRODUCT,FEATURE,'TS-02','ล็อกอินสำเร็จ + Remember me คงสถานะ','LG1, LG2, LG3, LG4, LG6 (Remember me)',
   ARR_TS02,'TS-02_TC-04','กด Log in','POSITIVE','SYSTEMTEST',
   'กดปุ่ม "Log in"',
   '-',
   'ล็อกอินสำเร็จ · redirect ไป /dashboard'],

  [PROJECT,PRODUCT,FEATURE,'TS-02','ล็อกอินสำเร็จ + Remember me คงสถานะ','LG1, LG2, LG3, LG4, LG6 (Remember me)',
   ARR_TS02,'TS-02_TC-05','ปิด browser แล้วเปิดใหม่','POSITIVE','SYSTEMTEST',
   'ปิด browser ทั้งหมด → เปิด browser ใหม่ → ไปที่ URL /dashboard',
   'URL = https://frontend-v2.hrms-sit.skyai.co.th/dashboard',
   'browser เข้าหน้า Dashboard โดยตรง · ไม่ redirect กลับหน้า Login · ยังล็อกอินอยู่'],

  // TS-03
  [PROJECT,PRODUCT,FEATURE,'TS-03','ล็อกอินสำเร็จด้วย Lark Account (SSO)','LG8 (Lark SSO มีสิทธิ์)',
   ARR_TS03,'TS-03_TC-01','เปิดหน้า Login','POSITIVE','SYSTEMTEST',
   'เปิด /login ใน browser',
   'https://frontend-v2.hrms-sit.skyai.co.th/login?go=/dashboard',
   'แสดงหน้า Login · ปุ่ม "Login With Lark Account" ปรากฏอยู่ด้านล่างของ form'],

  [PROJECT,PRODUCT,FEATURE,'TS-03','ล็อกอินสำเร็จด้วย Lark Account (SSO)','LG8 (Lark SSO มีสิทธิ์)',
   ARR_TS03,'TS-03_TC-02','กดปุ่ม Login With Lark Account','POSITIVE','SYSTEMTEST',
   'กดปุ่ม "Login With Lark Account"',
   '-',
   'Browser redirect ไปหน้า Lark authorization · แสดงหน้าขอสิทธิ์ Lark login'],

  [PROJECT,PRODUCT,FEATURE,'TS-03','ล็อกอินสำเร็จด้วย Lark Account (SSO)','LG8 (Lark SSO มีสิทธิ์)',
   ARR_TS03,'TS-03_TC-03','อนุมัติ Lark OAuth','POSITIVE','SYSTEMTEST',
   'คลิกอนุมัติ (Authorize) บนหน้า Lark auth',
   'Lark account มีสิทธิ์ HRMS',
   'Browser redirect กลับมา HRMS · เข้าหน้า /dashboard · ล็อกอินสำเร็จ'],

  // TS-04
  [PROJECT,PRODUCT,FEATURE,'TS-04','Eye toggle สลับแสดง/ซ่อน Password','LG5 (Eye toggle State Transition)',
   ARR_TS04,'TS-04_TC-01','ตรวจ state เริ่มต้น Password Hidden','POSITIVE','SYSTEMTEST',
   'ดู Password field หลังจากพิมพ์รหัส (ก่อนกด eye)',
   'Password = Kae@2024!',
   'Password field แสดงเป็น "••••••••" (mask) · icon = eye-off (ตาปิด) · initial state = Hidden'],

  [PROJECT,PRODUCT,FEATURE,'TS-04','Eye toggle สลับแสดง/ซ่อน Password','LG5 (Eye toggle State Transition)',
   ARR_TS04,'TS-04_TC-02','กด eye icon → Hidden to Shown','POSITIVE','SYSTEMTEST',
   'กด icon eye ทางขวาของ Password field (Hidden state)',
   '-',
   'Password field แสดงเป็น plaintext "Kae@2024!" · icon เปลี่ยนเป็น eye-on (ตาเปิด) · state = Shown'],

  [PROJECT,PRODUCT,FEATURE,'TS-04','Eye toggle สลับแสดง/ซ่อน Password','LG5 (Eye toggle State Transition)',
   ARR_TS04,'TS-04_TC-03','กด eye icon อีกครั้ง → Shown to Hidden','POSITIVE','SYSTEMTEST',
   'กด icon eye ทางขวาของ Password field (Shown state)',
   '-',
   'Password field กลับเป็น "••••••••" (mask) · icon เปลี่ยนกลับเป็น eye-off (ตาปิด) · state = Hidden'],

  // TA-01
  [PROJECT,PRODUCT,FEATURE,'TA-01','ล็อกอินไม่สำเร็จ – Password ผิด','LG3 (Password ไม่ตรง), LG4',
   ARR_TA01,'TA-01_TC-01','เปิดหน้า Login','NEGATIVE','SYSTEMTEST',
   'เปิด /login?go=/dashboard ใน incognito browser',
   'https://frontend-v2.hrms-sit.skyai.co.th/login?go=/dashboard',
   'แสดงหน้า Login · Organization dropdown (ไม่มี default)'],

  [PROJECT,PRODUCT,FEATURE,'TA-01','ล็อกอินไม่สำเร็จ – Password ผิด','LG3 (Password ไม่ตรง), LG4',
   ARR_TA01,'TA-01_TC-02','เลือก Org + กรอก Username','NEGATIVE','SYSTEMTEST',
   'เลือก Org "SKY AI" · กรอก Username',
   'Org = SKY AI · Username = ketwadee.kae',
   'Organization = SKY AI · Username = ketwadee.kae'],

  [PROJECT,PRODUCT,FEATURE,'TA-01','ล็อกอินไม่สำเร็จ – Password ผิด','LG3 (Password ไม่ตรง), LG4',
   ARR_TA01,'TA-01_TC-03','กรอก Password ผิด','NEGATIVE','SYSTEMTEST',
   'กรอก Password ที่ไม่ตรงกับบัญชี',
   'Password = WrongPass9',
   'Password field แสดง mask "•••••••••" (9 จุด)'],

  [PROJECT,PRODUCT,FEATURE,'TA-01','ล็อกอินไม่สำเร็จ – Password ผิด','LG3 (Password ไม่ตรง), LG4',
   ARR_TA01,'TA-01_TC-04','กด Log in ด้วย Password ผิด','NEGATIVE','SYSTEMTEST',
   'กดปุ่ม "Log in"',
   '-',
   'ล็อกอินไม่สำเร็จ · ยังอยู่หน้า Login · แสดง error message "" (HA1: รอยืนยัน exact text) · ไม่มีการล็อกบัญชี (ลองใหม่ได้)'],

  // TA-02
  [PROJECT,PRODUCT,FEATURE,'TA-02','ล็อกอินไม่สำเร็จ – Username ไม่มีในระบบ','LG2 (Username ไม่มีในระบบ), LG4',
   ARR_TA02,'TA-02_TC-01','เปิดหน้า Login','NEGATIVE','SYSTEMTEST',
   'เปิด /login?go=/dashboard ใน incognito',
   'https://frontend-v2.hrms-sit.skyai.co.th/login?go=/dashboard',
   'แสดงหน้า Login'],

  [PROJECT,PRODUCT,FEATURE,'TA-02','ล็อกอินไม่สำเร็จ – Username ไม่มีในระบบ','LG2 (Username ไม่มีในระบบ), LG4',
   ARR_TA02,'TA-02_TC-02','เลือก Org','NEGATIVE','SYSTEMTEST',
   'เลือก Org "SKY AI"',
   'Org = SKY AI',
   'Organization dropdown แสดง "SKY AI"'],

  [PROJECT,PRODUCT,FEATURE,'TA-02','ล็อกอินไม่สำเร็จ – Username ไม่มีในระบบ','LG2 (Username ไม่มีในระบบ), LG4',
   ARR_TA02,'TA-02_TC-03','กรอก Username ที่ไม่มีในระบบ','NEGATIVE','SYSTEMTEST',
   'กรอก Username ที่ไม่มีอยู่ใน Org "SKY AI"',
   'Username = napat.cha',
   'Username field แสดง "napat.cha"'],

  [PROJECT,PRODUCT,FEATURE,'TA-02','ล็อกอินไม่สำเร็จ – Username ไม่มีในระบบ','LG2 (Username ไม่มีในระบบ), LG4',
   ARR_TA02,'TA-02_TC-04','กด Log in ด้วย Username ที่ไม่มีในระบบ','NEGATIVE','SYSTEMTEST',
   'กรอก Password ถูกรูปแบบ แล้วกด "Log in"',
   'Password = Kae@2024!',
   'ล็อกอินไม่สำเร็จ · ยังอยู่หน้า Login · แสดง error message "" (HA1: ข้อความเดียวกับรหัสผิด — ไม่แยก เพื่อกัน account enumeration)'],

  // TA-03
  [PROJECT,PRODUCT,FEATURE,'TA-03','ไม่เลือก Organization (required error)','LG1 (Org required), LG4',
   ARR_TA03,'TA-03_TC-01','เปิดหน้า Login','NEGATIVE','SYSTEMTEST',
   'เปิด /login?go=/dashboard ใน incognito',
   'https://frontend-v2.hrms-sit.skyai.co.th/login?go=/dashboard',
   'แสดงหน้า Login · Organization dropdown ยังเป็น placeholder "Select Organization"'],

  [PROJECT,PRODUCT,FEATURE,'TA-03','ไม่เลือก Organization (required error)','LG1 (Org required), LG4',
   ARR_TA03,'TA-03_TC-02','กรอก Username + Password (ไม่เลือก Org)','NEGATIVE','SYSTEMTEST',
   'กรอก Username field + Password field โดยไม่เลือก Organization',
   'Username = ketwadee.kae · Password = Kae@2024! · Org = ไม่เลือก',
   'Username และ Password field มีค่า · Organization ยังแสดง placeholder "Select Organization"'],

  [PROJECT,PRODUCT,FEATURE,'TA-03','ไม่เลือก Organization (required error)','LG1 (Org required), LG4',
   ARR_TA03,'TA-03_TC-03','กด Log in โดยไม่เลือก Org','NEGATIVE','SYSTEMTEST',
   'กดปุ่ม "Log in"',
   '-',
   'Organization field มีกรอบสีแดง · แสดงข้อความ "Please input your Organization!" ใต้ field · ไม่ redirect'],

  // TA-04
  [PROJECT,PRODUCT,FEATURE,'TA-04','ไม่กรอกข้อมูลใดเลย (ทุก required ว่าง)','LG4 (ทุก required field ว่าง)',
   ARR_TA04,'TA-04_TC-01','เปิดหน้า Login ไม่กรอกอะไร','NEGATIVE','SYSTEMTEST',
   'เปิด /login?go=/dashboard ใน incognito · ไม่เลือก/กรอกอะไรทั้งสิ้น',
   'ทุก field ว่าง',
   'หน้า Login แสดง · ทุก field ว่าง · ยังไม่มี error'],

  [PROJECT,PRODUCT,FEATURE,'TA-04','ไม่กรอกข้อมูลใดเลย (ทุก required ว่าง)','LG4 (ทุก required field ว่าง)',
   ARR_TA04,'TA-04_TC-02','กด Log in โดยไม่กรอกอะไร','NEGATIVE','SYSTEMTEST',
   'กดปุ่ม "Log in"',
   '-',
   'Organization field กรอบแดง + "Please input your Organization!" · Username field กรอบแดง + "Please input your Username!" · Password field กรอบแดง + "Please input your Password!" · ไม่ redirect'],

  // TA-05
  [PROJECT,PRODUCT,FEATURE,'TA-05','Lark Account ไม่มีสิทธิ์ HRMS','LG8 (SSO ไม่มีสิทธิ์)',
   ARR_TA05,'TA-05_TC-01','เปิดหน้า Login','NEGATIVE','SYSTEMTEST',
   'เปิด /login ใน browser',
   'https://frontend-v2.hrms-sit.skyai.co.th/login?go=/dashboard',
   'แสดงหน้า Login · ปุ่ม "Login With Lark Account" ปรากฏ'],

  [PROJECT,PRODUCT,FEATURE,'TA-05','Lark Account ไม่มีสิทธิ์ HRMS','LG8 (SSO ไม่มีสิทธิ์)',
   ARR_TA05,'TA-05_TC-02','กด Lark SSO ด้วยบัญชีที่ไม่มีสิทธิ์','NEGATIVE','SYSTEMTEST',
   'กด "Login With Lark Account" → เลือกบัญชี Lark ที่ไม่มีสิทธิ์ HRMS',
   'Lark account = ไม่มีสิทธิ์ HRMS (Sit)',
   'แสดงข้อความ "You don\'t have the access to \\"HRMS (Sit)\\"" (HA5: รอยืนยัน exact text) · ไม่เข้า Dashboard'],

  // TA-06
  [PROJECT,PRODUCT,FEATURE,'TA-06','ไม่ติ๊ก Remember me → ต้องล็อกอินใหม่','LG6 (ไม่ติ๊ก Remember me)',
   ARR_TA06,'TA-06_TC-01','เปิดหน้า Login','POSITIVE','SYSTEMTEST',
   'เปิด /login?go=/dashboard ใน incognito browser',
   'https://frontend-v2.hrms-sit.skyai.co.th/login?go=/dashboard',
   'แสดงหน้า Login · checkbox "Remember me" แสดง (ค่าเริ่มต้น = ✅ checked)'],

  [PROJECT,PRODUCT,FEATURE,'TA-06','ไม่ติ๊ก Remember me → ต้องล็อกอินใหม่','LG6 (ไม่ติ๊ก Remember me)',
   ARR_TA06,'TA-06_TC-02','เลือก Org + กรอก credentials','POSITIVE','SYSTEMTEST',
   'เลือก Org "SKY AI" · กรอก Username + Password',
   'Org = SKY AI · Username = ketwadee.kae · Password = Kae@2024!',
   'ทุก field มีค่าครบ'],

  [PROJECT,PRODUCT,FEATURE,'TA-06','ไม่ติ๊ก Remember me → ต้องล็อกอินใหม่','LG6 (ไม่ติ๊ก Remember me)',
   ARR_TA06,'TA-06_TC-03','ยกเลิก checkbox Remember me','POSITIVE','SYSTEMTEST',
   'คลิก checkbox "Remember me" เพื่อ uncheck',
   'Remember me = ☐ unchecked',
   'checkbox "Remember me" ไม่มีเครื่องหมาย ✅ · state = unchecked'],

  [PROJECT,PRODUCT,FEATURE,'TA-06','ไม่ติ๊ก Remember me → ต้องล็อกอินใหม่','LG6 (ไม่ติ๊ก Remember me)',
   ARR_TA06,'TA-06_TC-04','กด Log in','POSITIVE','SYSTEMTEST',
   'กดปุ่ม "Log in"',
   '-',
   'ล็อกอินสำเร็จ · redirect ไป /dashboard · เข้าหน้า Dashboard'],

  [PROJECT,PRODUCT,FEATURE,'TA-06','ไม่ติ๊ก Remember me → ต้องล็อกอินใหม่','LG6 (ไม่ติ๊ก Remember me)',
   ARR_TA06,'TA-06_TC-05','ปิด browser + เปิดใหม่ → ตรวจ session','POSITIVE','SYSTEMTEST',
   'ปิด browser ทั้งหมด → เปิด browser ใหม่ → ไปที่ URL /dashboard',
   'URL = https://frontend-v2.hrms-sit.skyai.co.th/dashboard',
   'ระบบ redirect กลับหน้า Login (/login?go=/dashboard) · ต้องล็อกอินใหม่ · ไม่สามารถเข้า /dashboard โดยตรงได้'],

  // SEC-01
  [PROJECT,PRODUCT,FEATURE,'SEC-01','Open Redirect – ?go= external URL (Security)','LG7 (redirect security)',
   ARR_SEC01,'SEC-01_TC-01','เปิด login URL ที่มี ?go= ชี้ external URL','NEGATIVE','SYSTEMTEST',
   'เปิด /login?go=https://google.com ใน browser',
   'URL = https://frontend-v2.hrms-sit.skyai.co.th/login?go=https://google.com',
   'หน้า Login โหลดขึ้น · form ยังแสดงปกติ · URL parameter ?go=https://google.com ถูก set'],

  [PROJECT,PRODUCT,FEATURE,'SEC-01','Open Redirect – ?go= external URL (Security)','LG7 (redirect security)',
   ARR_SEC01,'SEC-01_TC-02','ล็อกอินสำเร็จด้วย credentials ถูกต้อง → ตรวจ redirect','NEGATIVE','SYSTEMTEST',
   'กรอก Org "SKY AI" + Username ketwadee.kae + Password ถูกต้อง แล้วกด "Log in"',
   'Org = SKY AI · Username = ketwadee.kae · Password = Kae@2024!',
   'HA6: รอยืนยัน — ถ้าไม่แก้: redirect ออกไป https://google.com (⚠️ Open Redirect bug) | ถ้าแก้แล้ว: redirect ไป /dashboard แทน (บล็อก external URL)'],
];

// ─── Build xlsx from template ───────────────────────────────────────────────
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(TEMPLATE);

const ws = wb.worksheets.find(s => s.name !== 'README' && s.name !== 'Instructions') || wb.worksheets[0];

// Find header row (row 2) and map column indices
const headerRow = ws.getRow(2);
const hdr = {};
headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
  hdr[String(cell.value || '').replace(/\n/g, ' ').trim()] = col;
});

// Column name helpers
const COL = {
  proj   : hdr['Project Name'],
  prod   : hdr['Product'],
  feat   : hdr['Feature'],
  scnNo  : hdr['Scenario No.'],
  scnName: hdr['Scenario Name'],
  bizCond: hdr['Business Conditions'],
  arrange: hdr['Arrange\n(สิ่งที่ต้องเตรียมก่อนการทดสอบ)'] || hdr['Arrange (สิ่งที่ต้องเตรียมก่อนการทดสอบ)'],
  tcNo   : hdr['TC No.'],
  title  : hdr['Case Title Name'],
  cat    : hdr['Test category'],
  type   : hdr['Test Type'],
  steps  : hdr['Test Steps'],
  data   : hdr['Data Test'],
  exp    : hdr['Expected Result'],
};

// Fix arrange column lookup (multiline key)
if (!COL.arrange) {
  headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
    const v = String(cell.value || '');
    if (v.includes('Arrange') && v.includes('สิ่งที่ต้องเตรียม')) COL.arrange = col;
  });
}

// Remove template sample rows (keep rows 1-2 only)
const lastRow = ws.rowCount;
for (let r = lastRow; r >= 3; r--) ws.spliceRows(r, 1);

// Write data rows starting at row 3
rows.forEach((r, i) => {
  const rowNum = i + 3;
  const row = ws.getRow(rowNum);
  const set = (col, val) => { if (col) row.getCell(col).value = val; };

  set(COL.proj,    r[0]);
  set(COL.prod,    r[1]);
  set(COL.feat,    r[2]);
  set(COL.scnNo,   r[3]);
  set(COL.scnName, r[4]);
  set(COL.bizCond, r[5]);
  set(COL.arrange, r[6]);
  set(COL.tcNo,    r[7]);
  set(COL.title,   r[8]);
  set(COL.cat,     r[9]);
  set(COL.type,    r[10]);
  set(COL.steps,   r[11]);
  set(COL.data,    r[12]);
  set(COL.exp,     r[13]);

  row.commit();
});

await wb.xlsx.writeFile(OUT);
console.log(`✅ Created: ${OUT}`);
console.log(`   Scenarios: TS-01..TS-04, TA-01..TA-06, SEC-01`);
console.log(`   Total rows (TCs): ${rows.length}`);

// Dry-run summary
const scenarios = [...new Set(rows.map(r => r[3]))];
const summary = {};
scenarios.forEach(s => {
  summary[s] = rows.filter(r => r[3] === s).length;
});
console.log('\n📊 DRY-RUN SUMMARY:');
console.log('Feature: Login | Project: HRMS | Product: HRMS');
console.log('Lark Base: tblIwUWXkWNLYy4c');
Object.entries(summary).forEach(([s, n]) => {
  const type = s.startsWith('TS') ? '✅' : s.startsWith('TA') ? '❌' : '🔒';
  console.log(`  ${type} ${s}: ${n} TC(s)`);
});
console.log(`  Total: ${rows.length} record(s) to insert`);
