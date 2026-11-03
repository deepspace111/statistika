// connection-test.mjs
// בדיקת חיבור חד-פעמית: OpenAI כותב הודעה קצרה ל-Claude, Claude עונה, והכול נשמר בקובץ.
// בלי לולאה: שתי קריאות בלבד. המפתחות לא נמצאים בקוד ולא נשמרים ביומן.
//
// הרצה:  node connection-test.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---------- 1. קריאת המפתחות (מחוץ לקוד) ----------
// מחפש קובץ בתיקייה של הסקריפט, לפי הסדר: .env, keys.env, keys.txt
// שורות בפורמט:  שם=ערך   (שורות שמתחילות ב-# מתעלמים מהן)
function loadKeysFile() {
  for (const name of [".env", "keys.env", "keys.txt"]) {
    const file = path.join(HERE, name);
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, "utf8").replace(/^﻿/, "");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq < 1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
    return name;
  }
  return null;
}

const keysFileUsed = loadKeysFile();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// שמות המודלים ניתנים לשינוי בקובץ המפתחות, בלי לגעת בקוד.
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

const OPENAI_URL =
  (process.env.OPENAI_BASE_URL || "https://api.openai.com") + "/v1/chat/completions";
const ANTHROPIC_URL =
  (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com") + "/v1/messages";

const MAX_TOKENS = 150; // תקרה קטנה כדי שהבדיקה תעלה אגורות
const TIMEOUT_MS = 30000;

// ---------- 2. יומן ----------
const startedAt = new Date();
const log = {
  startedAt: startedAt.toISOString(),
  purpose: "בדיקת חיבור OpenAI -> Claude (ללא לולאה)",
  models: { openai: OPENAI_MODEL, anthropic: ANTHROPIC_MODEL },
  steps: [],
  status: "running",
};

function stamp(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function saveLog() {
  const dir = path.join(HERE, "logs");
  fs.mkdirSync(dir, { recursive: true });
  const base = path.join(dir, `connection-test-${stamp(startedAt)}`);
  fs.writeFileSync(base + ".json", JSON.stringify(log, null, 2), "utf8");

  const lines = [];
  lines.push(`בדיקת חיבור: ${log.startedAt}`);
  lines.push(`מודלים: OpenAI=${OPENAI_MODEL} | Claude=${ANTHROPIC_MODEL}`);
  lines.push(`סטטוס: ${log.status}`);
  lines.push("");
  for (const s of log.steps) {
    lines.push(`--- ${s.from} -> ${s.to} (${s.time}) ---`);
    lines.push(s.text ?? `[שגיאה] ${s.error}`);
    if (s.usage) lines.push(`(טוקנים: ${JSON.stringify(s.usage)})`);
    lines.push("");
  }
  fs.writeFileSync(base + ".txt", lines.join("\n"), "utf8");
  return base;
}

function fail(message) {
  console.error("\n[נכשל] " + message);
  log.status = "failed: " + message;
  const base = saveLog();
  console.error(`היומן נשמר ב: ${base}.txt`);
  process.exit(1);
}

// ---------- 3. בדיקות לפני ההרצה ----------
const missing = [];
if (!OPENAI_API_KEY) missing.push("OPENAI_API_KEY");
if (!ANTHROPIC_API_KEY) missing.push("ANTHROPIC_API_KEY");
if (missing.length) {
  console.error("\n[חסר] לא נמצאו: " + missing.join(", "));
  console.error(
    keysFileUsed
      ? `קראתי את הקובץ ${keysFileUsed} אבל השמות האלה לא מופיעים בו.`
      : "לא מצאתי קובץ מפתחות. צריך קובץ בשם .env (או keys.env / keys.txt) באותה תיקייה של הסקריפט."
  );
  console.error("כל שורה בפורמט:  OPENAI_API_KEY=המפתח   ו-   ANTHROPIC_API_KEY=המפתח");
  process.exit(1);
}

function explain(provider, status, bodyText) {
  const short = bodyText.slice(0, 300);
  if (status === 401) return `${provider}: המפתח לא תקין או הועתק לא מלא (401).`;
  if (status === 403) return `${provider}: אין הרשאה למפתח או למודל הזה (403).`;
  if (status === 404) return `${provider}: המודל לא נמצא (404). אפשר לשנות את שם המודל בקובץ המפתחות.`;
  if (status === 429) return `${provider}: חריגה ממגבלה או שנגמר הקרדיט (429). ${short}`;
  if (status === 400 && /credit/i.test(bodyText)) return `${provider}: אין קרדיט בחשבון. ${short}`;
  return `${provider}: שגיאה ${status}. ${short}`;
}

async function postJson(url, headers, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

// ---------- 4. שלב א: OpenAI כותב הודעה ל-Claude ----------
console.log(`שלב 1: מבקשים מ-OpenAI (${OPENAI_MODEL}) לכתוב הודעה ל-Claude...`);

let openaiMessage;
try {
  const r = await postJson(
    OPENAI_URL,
    { authorization: `Bearer ${OPENAI_API_KEY}` },
    {
      model: OPENAI_MODEL,
      max_completion_tokens: MAX_TOKENS,
      messages: [
        {
          role: "system",
          content:
            "You are one AI system in a connection test with another AI system (Claude). " +
            "Write ONE short message to Claude (at most 2 sentences). " +
            "Say this is a connection test and ask Claude to reply with a short confirmation. " +
            "Do not ask anything else.",
        },
        { role: "user", content: "Write the message now." },
      ],
    }
  );
  if (!r.ok) fail(explain("OpenAI", r.status, r.text));
  const data = JSON.parse(r.text);
  openaiMessage = data.choices?.[0]?.message?.content?.trim();
  if (!openaiMessage) fail("OpenAI החזיר תשובה ריקה. אם המודל הוא מסוג חשיבה, נסו מודל אחר ב-OPENAI_MODEL.");
  log.steps.push({
    from: "OpenAI",
    to: "Claude",
    time: new Date().toISOString(),
    text: openaiMessage,
    usage: data.usage ?? null,
  });
} catch (e) {
  fail("OpenAI: לא הצלחתי להתחבר. " + (e?.message || e));
}
console.log("OpenAI כתב:\n  " + openaiMessage + "\n");

// ---------- 5. שלב ב: Claude עונה ----------
console.log(`שלב 2: שולחים את ההודעה ל-Claude (${ANTHROPIC_MODEL})...`);

try {
  const r = await postJson(
    ANTHROPIC_URL,
    { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    {
      model: ANTHROPIC_MODEL,
      max_tokens: MAX_TOKENS,
      system:
        "This is a connection test between two AI systems. Reply briefly (at most 2 sentences).",
      messages: [{ role: "user", content: openaiMessage }],
    }
  );
  if (!r.ok) fail(explain("Anthropic", r.status, r.text));
  const data = JSON.parse(r.text);
  const reply = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  if (!reply) fail("Claude החזיר תשובה ריקה.");
  log.steps.push({
    from: "Claude",
    to: "OpenAI",
    time: new Date().toISOString(),
    text: reply,
    usage: data.usage ?? null,
  });
  console.log("Claude ענה:\n  " + reply + "\n");
} catch (e) {
  fail("Anthropic: לא הצלחתי להתחבר. " + (e?.message || e));
}

// ---------- 6. סיום ----------
log.status = "ok";
const base = saveLog();
console.log("הבדיקה עברה. התכתובת נשמרה ב:");
console.log("  " + base + ".txt");
console.log("  " + base + ".json");
