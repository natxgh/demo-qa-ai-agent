#!/bin/bash
# poll-po-cron.sh — รัน poll:po 3 ครั้ง/วัน ผ่าน crontab (9:30 / 13:30 / 16:30 Bangkok)
# crontab: 30 2,6,9 * * 1-5 /path/to/poll-po-cron.sh >> /tmp/poll-po.log 2>&1
#
# Secrets อยู่ใน automation/.lark-cron.env (gitignored) — คัดลอกจาก .lark-cron.env.example แล้วเติมค่า:
#   LARK_APP_ID=...
#   LARK_APP_SECRET=...

set -a
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"   # .../automation
[ -f "$DIR/.lark-cron.env" ] && . "$DIR/.lark-cron.env"
set +a

if [ -z "$LARK_APP_ID" ] || [ -z "$LARK_APP_SECRET" ]; then
  echo "❌ ไม่พบ LARK_APP_ID / LARK_APP_SECRET — สร้าง $DIR/.lark-cron.env จาก .lark-cron.env.example ก่อน" >&2
  exit 1
fi

cd "$DIR"

echo "=== poll-po $(date '+%Y-%m-%d %H:%M') ==="
node scripts/poll-po.mjs
EXIT=$?

if [ $EXIT -eq 2 ]; then
  echo "✅ PO ตอบครบแล้ว → answers.json พร้อม — เปิด Claude Code แล้วรัน /ask-po เพื่อ apply"
fi
