// signal-game.mjs
// ניסוי איתות: שולח (רואה צבע) -> סמל -> מקבל (מנחש צבע). שתי פאזות:
//   פיילוט: סבבים עם היסטוריה ומשוב.   בדיקה: סבבים בלי משוב, היסטוריית הפיילוט מוקפאת.
// זו בדיקת מוסכמה בתוך הקשר. היא לא מוכיחה שנוצרה שפה חדשה.
//
// הרצה רגילה:        node signal-game.mjs
// אפשרויות:          --pilot 60  --test 20  --seed 123  --swap  --baseline
//   --swap      OpenAI שולח ו-Claude מקבל (ברירת מחדל: Claude שולח, OpenAI מקבל)
//   --baseline  בסבבי הבדיקה, מקבל "קר" בלי היסטוריה מנחש גם הוא (מודד אסוציאציות קיימות)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---------- מפתחות (מחוץ לקוד) ----------
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
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
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
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";
const OPENAI_URL = (process.env.OPENAI_BASE_URL || "https://api.openai.com") + "/v1/chat/completions";
const ANTHROPIC_URL = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com") + "/v1/messages";

// ---------- הגדרות ----------
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => {
  const i = args.indexOf(n);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : d;
};

const COLORS = ["red", "green", "blue", "yellow"];
const PILOT = parseInt(opt("--pilot", "60"), 10);
const TEST = parseInt(opt("--test", "20"), 10);
const SEED = parseInt(opt("--seed", String(Math.floor(Math.random() * 2 ** 31))), 10);
const SWAP = flag("--swap");
const BASELINE = flag("--baseline");
const ALPHABET_SIZE = 8;
const MAX_TOKENS = 24;
const TIMEOUT_MS = 30000;
const MAX_CALLS = Math.ceil(1.5 * (2 * (PILOT + TEST) + (BASELINE ? TEST : 0))) + 10; // תקרה קשיחה, כולל ניסיונות חוזרים

const SENDER = SWAP ? "openai" : "anthropic";
const RECEIVER = SWAP ? "anthropic" : "openai";

if (!Number.isInteger(PILOT) || !Number.isInteger(TEST) || PILOT < 4 || TEST < 4 || PILOT % 4 || TEST % 4) {
  console.error("[שגיאה] --pilot ו---test חייבים להיות מספרים שלמים שמתחלקים ב-4, כדי שכל צבע יופיע בכמות שווה.");
  process.exit(1);
}
const missing = [];
if (!OPENAI_API_KEY) missing.push("OPENAI_API_KEY");
if (!ANTHROPIC_API_KEY) missing.push("ANTHROPIC_API_KEY");
if (missing.length) {
  console.error("[חסר] לא נמצאו: " + missing.join(", ") + (keysFileUsed ? ` (קראתי את ${keysFileUsed})` : " (לא נמצא קובץ .env בתיקייה)"));
  process.exit(1);
}

// ---------- אקראיות עם seed (כדי שאפשר לשחזר) ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);
const ri = (n) => Math.floor(rand() * n);
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = ri(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function balanced(n) {
  const out = [];
  for (let i = 0; i < n / COLORS.length; i++) out.push(...COLORS);
  return shuffle(out);
}

// אלפבית של מילים מומצאות (CVCV), בלי שתי מילים שמתחילות באותה אות
function makeAlphabet(n) {
  const C = "bdfgklmnprstvz", V = "aeiou";
  const BLOCK = /^(sofa|soda|data|lava|lama|mama|papa|dada|zero|kilo|mono|more|bone|done|gone|none|lone|tone|zone|male|mile|mule|pole|pale|bale|dale|gale|kale|rule|sole|tale|toga|pika|kola|mono|tuna|tofu|taco|pita|tara|sara|dina|nina|mira|lena|dana)$/;
  const words = [], firsts = new Set();
  while (words.length < n) {
    const w = C[ri(C.length)] + V[ri(5)] + C[ri(C.length)] + V[ri(5)];
    if (BLOCK.test(w) || firsts.has(w[0]) || words.includes(w)) continue;
    firsts.add(w[0]);
    words.push(w);
  }
  return words;
}
const ALPHABET = makeAlphabet(ALPHABET_SIZE);

// ---------- יומן ----------
const startedAt = new Date();
const p2 = (n) => String(n).padStart(2, "0");
const stamp = `${startedAt.getFullYear()}${p2(startedAt.getMonth() + 1)}${p2(startedAt.getDate())}-${p2(startedAt.getHours())}${p2(startedAt.getMinutes())}${p2(startedAt.getSeconds())}`;
const state = {
  startedAt: startedAt.toISOString(),
  purpose: "משחק איתות: סמל <-> צבע (פיילוט עם משוב + בדיקה בלי משוב)",
  note: "בדיקת מוסכמה בתוך הקשר. אינה הוכחה שנוצרה שפה חדשה.",
  config: { seed: SEED, pilot: PILOT, test: TEST, baseline: BASELINE, colors: COLORS, alphabet: ALPHABET, sender: { provider: SENDER, model: SENDER === "openai" ? OPENAI_MODEL : ANTHROPIC_MODEL }, receiver: { provider: RECEIVER, model: RECEIVER === "openai" ? OPENAI_MODEL : ANTHROPIC_MODEL } },
  status: "running",
  rounds: [],
  usage: { openai: { in: 0, out: 0 }, anthropic: { in: 0, out: 0 } },
  calls: 0,
};

function summarize() {
  const pilot = state.rounds.filter((r) => r.phase === "pilot");
  const test = state.rounds.filter((r) => r.phase === "test");
  const acc = (rs) => (rs.length ? rs.filter((r) => r.correct).length / rs.length : null);
  const blocks = [];
  for (let i = 0; i < pilot.length; i += 10) {
    const b = pilot.slice(i, i + 10);
    blocks.push({ rounds: `${i + 1}-${i + b.length}`, accuracy: acc(b) });
  }
  const tail = (rs, k) => rs.slice(-k);
  const cold = test.filter((r) => r.coldGuess !== undefined);
  const mapping = (rs) => {
    const m = {};
    for (const c of COLORS) m[c] = {};
    for (const r of rs) if (r.symbol) m[r.color][r.symbol] = (m[r.color][r.symbol] || 0) + 1;
    return m;
  };
  const purity = (rs) => {
    // כמה מהסבבים "מוסברים" על ידי הצבע השכיח לכל סמל
    const bySym = {};
    for (const r of rs) if (r.symbol) { (bySym[r.symbol] ||= {})[r.color] = ((bySym[r.symbol] || {})[r.color] || 0) + 1; }
    let ok = 0, n = 0;
    for (const s of Object.values(bySym)) { const v = Object.values(s); ok += Math.max(...v); n += v.reduce((a, b) => a + b, 0); }
    return n ? ok / n : null;
  };
  return {
    pilotAccuracyOverall: acc(pilot),
    pilotBlocksOf10: blocks,
    pilotLast20Accuracy: acc(tail(pilot, 20)),
    pilotLast20_pValueVsChance: binomTail(tail(pilot, 20).filter((r) => r.correct).length, Math.min(20, pilot.length)),
    testAccuracy: acc(test),
    testCorrect: test.filter((r) => r.correct).length,
    testN: test.length,
    testPValueVsChance25: binomTail(test.filter((r) => r.correct).length, test.length),
    coldReceiverAccuracy: cold.length ? cold.filter((r) => r.coldGuess === r.color).length / cold.length : null,
    mappingColorToSymbol_pilotLast20: mapping(tail(pilot, 20)),
    mappingColorToSymbol_test: mapping(test),
    symbolPurity_pilotLast20: purity(tail(pilot, 20)),
    symbolPurity_test: purity(test),
    invalidRounds: state.rounds.filter((r) => r.invalid).length,
  };
}

// P(X >= x) כש-X ~ Binomial(n, 0.25)
function binomTail(x, n) {
  if (!n) return null;
  let pmf = Math.pow(0.75, n), tail = 0;
  for (let k = 0; k <= n; k++) {
    if (k >= x) tail += pmf;
    pmf = pmf * ((n - k) / (k + 1)) * (1 / 3);
  }
  return Math.min(1, tail);
}

function pct(v) { return v === null || v === undefined ? "-" : (v * 100).toFixed(0) + "%"; }

function saveAll() {
  const dir = path.join(HERE, "logs");
  fs.mkdirSync(dir, { recursive: true });
  const base = path.join(dir, `signal-game-${stamp}`);
  const summary = summarize();
  fs.writeFileSync(base + ".json", JSON.stringify({ ...state, summary }, null, 2), "utf8");

  const L = [];
  L.push(`משחק איתות | ${state.startedAt} | סטטוס: ${state.status}`);
  L.push(state.note);
  L.push(`שולח: ${state.config.sender.model} | מקבל: ${state.config.receiver.model} | seed=${SEED}`);
  L.push(`אלפבית: ${ALPHABET.join(" ")}`);
  L.push("");
  L.push("--- סיכום ---");
  L.push(`פיילוט, דיוק כללי: ${pct(summary.pilotAccuracyOverall)}`);
  L.push("פיילוט, לפי בלוקים של 10: " + summary.pilotBlocksOf10.map((b) => `${b.rounds}:${pct(b.accuracy)}`).join("  "));
  L.push(`בדיקה (בלי משוב): ${summary.testCorrect}/${summary.testN} = ${pct(summary.testAccuracy)} | p מול ניחוש (25%): ${summary.testPValueVsChance25 === null ? "-" : summary.testPValueVsChance25.toFixed(4)}`);
  if (summary.coldReceiverAccuracy !== null) L.push(`מקבל קר (בלי היסטוריה), אותם סמלים: ${pct(summary.coldReceiverAccuracy)}`);
  L.push(`עקביות סמלים, בדיקה: ${pct(summary.symbolPurity_test)} | סבבים לא תקינים: ${summary.invalidRounds}`);
  L.push("");
  L.push("מיפוי צבע -> סמלים (בדיקה):");
  for (const c of COLORS) L.push(`  ${c}: ${JSON.stringify(summary.mappingColorToSymbol_test[c])}`);
  L.push("");
  L.push("--- כל הסבבים ---");
  for (const r of state.rounds) {
    L.push(`${r.phase} #${r.round}  צבע=${r.color}  סמל=${r.symbol}  ניחוש=${r.guess}  ${r.correct ? "נכון" : "שגוי"}${r.coldGuess !== undefined ? "  קר=" + r.coldGuess : ""}${r.invalid ? "  [לא תקין]" : ""}`);
  }
  L.push("");
  L.push(`קריאות: ${state.calls} | טוקנים OpenAI: ${state.usage.openai.in}+${state.usage.openai.out} | Anthropic: ${state.usage.anthropic.in}+${state.usage.anthropic.out}`);
  fs.writeFileSync(base + ".txt", L.join("\n"), "utf8");
  return base;
}

let aborting = false;
function abort(msg) {
  if (aborting) process.exit(1);
  aborting = true;
  console.error("\n[נעצר] " + msg);
  state.status = "aborted: " + msg;
  const base = saveAll();
  console.error(`יומן חלקי נשמר ב: ${base}.txt`);
  process.exit(1);
}

// ---------- קריאות API ----------
const RETRY_BASE_MS = parseInt(process.env.RETRY_BASE_MS || "2000", 10); // רק לבדיקות
async function http(url, headers, body) {
  for (let attempt = 0; attempt < 3; attempt++) {
    state.calls++; // כל ניסיון HTTP נספר, גם ניסיון חוזר
    if (state.calls > MAX_CALLS) abort("הגעתי לתקרת הקריאות שהוגדרה (" + MAX_CALLS + "), כולל ניסיונות חוזרים.");
    let res, text;
    try {
      res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(TIMEOUT_MS) });
      text = await res.text();
    } catch (e) {
      if (attempt === 2) abort("בעיית חיבור: " + (e?.message || e));
      await new Promise((r) => setTimeout(r, RETRY_BASE_MS * (attempt + 1)));
      continue;
    }
    if (res.ok) return text;
    const noCredit = /quota|credit|billing/i.test(text);
    if ((res.status === 429 || res.status >= 500) && !noCredit && attempt < 2) {
      await new Promise((r) => setTimeout(r, RETRY_BASE_MS * (attempt + 1)));
      continue;
    }
    if (res.status === 401) abort("מפתח לא תקין (401).");
    if (noCredit) abort("נגמר הקרדיט בחשבון (" + res.status + ").");
    abort(`שגיאה ${res.status}: ${text.slice(0, 200)}`);
  }
}

async function llm(provider, system, user) {
  if (provider === "openai") {
    const t = await http(OPENAI_URL, { authorization: `Bearer ${OPENAI_API_KEY}` }, {
      model: OPENAI_MODEL, max_completion_tokens: MAX_TOKENS,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    });
    const d = JSON.parse(t);
    state.usage.openai.in += d.usage?.prompt_tokens || 0;
    state.usage.openai.out += d.usage?.completion_tokens || 0;
    return (d.choices?.[0]?.message?.content || "").trim();
  }
  const t = await http(ANTHROPIC_URL, { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" }, {
    model: ANTHROPIC_MODEL, max_tokens: MAX_TOKENS, system,
    messages: [{ role: "user", content: user }],
  });
  const d = JSON.parse(t);
  state.usage.anthropic.in += d.usage?.input_tokens || 0;
  state.usage.anthropic.out += d.usage?.output_tokens || 0;
  return (d.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
}

// ---------- הנחיות ----------
const SENDER_SYSTEM =
  "You are the SENDER in a signaling game with a partner AI. You have no other way to communicate with the partner.\n" +
  `Each round you privately see ONE color from: ${COLORS.join(", ")}.\n` +
  `You must send exactly ONE symbol, chosen from this alphabet: ${ALPHABET.join(", ")}.\n` +
  "The partner sees only your symbol and must guess your color. You both succeed when the guess is correct.\n" +
  "The symbols have no built-in meaning. Any system you use has to be built from the history of previous rounds.\n" +
  "Reply with the symbol only, nothing else.";

const RECEIVER_SYSTEM =
  "You are the RECEIVER in a signaling game with a partner AI. You have no other way to communicate with the partner.\n" +
  `Each round your partner privately sees ONE color from: ${COLORS.join(", ")}, and sends you exactly ONE symbol from this alphabet: ${ALPHABET.join(", ")}.\n` +
  "You see only the symbol and must guess the color. You both succeed when your guess is correct.\n" +
  "The symbols have no built-in meaning. Any system you use has to be built from the history of previous rounds.\n" +
  "Reply with the color word only, nothing else.";

function pickOne(text, candidates) {
  const low = text.toLowerCase();
  const found = candidates.filter((c) => new RegExp(`(^|[^a-z])${c}([^a-z]|$)`).test(low));
  return found.length === 1 ? found[0] : null;
}

async function senderTurn(round, color, history, noFeedback) {
  const hist = history.length ? "Previous rounds:\n" + history.join("\n") + "\n\n" : "No previous rounds yet.\n\n";
  const note = noFeedback ? "(No feedback is given in this phase. The rounds above are all the information you have.)\n" : "";
  const user = `${hist}${note}Round ${round}. The color you see now: ${color.toUpperCase()}.\nYour symbol:`;
  for (let k = 0; k < 2; k++) {
    const out = await llm(SENDER, SENDER_SYSTEM, k ? user + "\n(Reply with exactly one symbol from the alphabet.)" : user);
    const s = pickOne(out, ALPHABET);
    if (s) return s;
  }
  return null;
}

async function receiverTurn(round, symbol, history, noFeedback) {
  const hist = history.length ? "Previous rounds:\n" + history.join("\n") + "\n\n" : "No previous rounds yet.\n\n";
  const note = noFeedback ? "(No feedback is given in this phase. The rounds above are all the information you have.)\n" : "";
  const user = `${hist}${note}Round ${round}. The symbol you received: ${symbol}.\nYour guess (one of: ${COLORS.join(", ")}):`;
  for (let k = 0; k < 2; k++) {
    const out = await llm(RECEIVER, RECEIVER_SYSTEM, k ? user + "\n(Reply with exactly one color word.)" : user);
    const g = pickOne(out, COLORS);
    if (g) return g;
  }
  return null;
}

process.on("SIGINT", () => abort("הופסק ידנית (Ctrl+C)"));
process.on("uncaughtException", (e) => abort("שגיאה לא צפויה: " + (e?.message || e)));
process.on("unhandledRejection", (e) => abort("שגיאה לא צפויה: " + (e?.message || e)));

// ---------- הרצה ----------
console.log(`משחק איתות | שולח: ${state.config.sender.model} | מקבל: ${state.config.receiver.model}`);
console.log(`אלפבית: ${ALPHABET.join(" ")} | seed=${SEED} | פיילוט ${PILOT} + בדיקה ${TEST}${BASELINE ? " + מקבל קר" : ""}`);
console.log(`תקרת קריאות: ${MAX_CALLS}\n`);

const pilotColors = balanced(PILOT);
const testColors = balanced(TEST);
const sHist = [], rHist = [];

for (let i = 0; i < PILOT; i++) {
  const color = pilotColors[i];
  const symbol = await senderTurn(i + 1, color, sHist, false);
  const guess = symbol ? await receiverTurn(i + 1, symbol, rHist, false) : null;
  const correct = guess === color;
  const invalid = !symbol || !guess;
  state.rounds.push({ phase: "pilot", round: i + 1, color, symbol, guess, correct, ...(invalid ? { invalid: true } : {}) });
  sHist.push(`Round ${i + 1}: you saw ${color.toUpperCase()}, you sent ${symbol}, partner guessed ${guess ? guess.toUpperCase() : "NOTHING"} (${correct ? "correct" : "wrong"})`);
  rHist.push(`Round ${i + 1}: you received ${symbol}, you guessed ${guess ? guess.toUpperCase() : "NOTHING"}, the true color was ${color.toUpperCase()} (${correct ? "correct" : "wrong"})`);
  saveAll(); // יומן מעודכן אחרי כל סבב
  if ((i + 1) % 10 === 0) {
    const b = state.rounds.filter((r) => r.phase === "pilot").slice(-10);
    console.log(`פיילוט ${i - 8}-${i + 1}: ${b.filter((r) => r.correct).length}/10 נכון`);
  }
}

// בדיקה: היסטוריית הפיילוט מוקפאת, אין משוב, אין עדכון
const sFrozen = [...sHist], rFrozen = [...rHist];
for (let i = 0; i < TEST; i++) {
  const color = testColors[i];
  const symbol = await senderTurn(PILOT + i + 1, color, sFrozen, true);
  const guess = symbol ? await receiverTurn(PILOT + i + 1, symbol, rFrozen, true) : null;
  const correct = guess === color;
  const invalid = !symbol || !guess;
  const rec = { phase: "test", round: i + 1, color, symbol, guess, correct, ...(invalid ? { invalid: true } : {}) };
  if (BASELINE && symbol) rec.coldGuess = await receiverTurn(1, symbol, [], false);
  state.rounds.push(rec);
  saveAll(); // יומן מעודכן אחרי כל סבב
}

state.status = "ok";
const base = saveAll();
const s = summarize();
console.log(`\nפיילוט, דיוק כללי: ${pct(s.pilotAccuracyOverall)} | בלוקים: ${s.pilotBlocksOf10.map((b) => pct(b.accuracy)).join(" ")}`);
console.log(`בדיקה בלי משוב: ${s.testCorrect}/${s.testN} = ${pct(s.testAccuracy)} (ניחוש = 25%) | p=${s.testPValueVsChance25?.toFixed(4)}`);
if (s.coldReceiverAccuracy !== null) console.log(`מקבל קר: ${pct(s.coldReceiverAccuracy)}`);
console.log(`\nהיומן נשמר ב:\n  ${base}.txt\n  ${base}.json`);
