// space-worker.js - הקוד המלא של ה-Worker עבור "המרחב"
// להדביק בעורך הקוד של ה-Worker בדשבורד של Cloudflare (Workers & Pages -> ה-Worker שלך -> Edit code)
//
// דורש שלושה bindings בהגדרות ה-Worker (Settings -> Bindings):
//   DB          -> D1 database (זה שיצרת והרצת עליו את space-schema.sql)
//   RATE_LIMIT  -> KV namespace (ליצור namespace חדש וריק, בלי צורך בהגדרה נוספת)
//
// ודורש ארבעה משתנים/סודות (Settings -> Variables and Secrets):
//   ALLOWED_ORIGIN   (Variable, לא סוד) = https://waytosee.io
//   OPENAI_API_KEY   (Secret)           = מפתח ה-API שלך מ-OpenAI
//   TURNSTILE_SECRET (Secret)           = ה-Secret Key שתקבל כשתיצור Widget ב-Turnstile
//   IP_HASH_SALT     (Secret)           = כל מחרוזת אקראית וארוכה שתבחר בעצמך (למשל תיצור באתר כמו passwordsgenerator.net) - לא צריך לזכור אותה, רק להדביק פעם אחת

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = env.ALLOWED_ORIGIN || "https://waytosee.io";

    const corsHeaders = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Space-Client",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      if (url.pathname === "/messages" && request.method === "GET") {
        return await handleGetMessages(env, corsHeaders);
      }
      if (url.pathname === "/messages" && request.method === "POST") {
        return await handlePostMessage(request, env, corsHeaders);
      }
      return new Response("Not found", { status: 404, headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ status: "error", reason: "server_error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  },

  // רץ אוטומטית לפי ה-Cron Trigger שתגדיר בדשבורד - מוחק הודעות בנות יותר מ-24 שעות
  async scheduled(event, env, ctx) {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    await env.DB.prepare("DELETE FROM messages WHERE created_at < ?").bind(cutoff).run();
  },
};

async function handleGetMessages(env, corsHeaders) {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const { results } = await env.DB.prepare(
    "SELECT id, content, created_at FROM messages WHERE created_at > ? ORDER BY created_at DESC LIMIT 200"
  ).bind(cutoff).all();

  return new Response(JSON.stringify({ messages: results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handlePostMessage(request, env, corsHeaders) {
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  // מגבילים את גודל הבקשה לפני שקוראים אותה במלואה לזיכרון - כדי שגוף בקשה ענק
  // לא ינצל משאבים לפני שבכלל הגענו לבדיקת אורך הטקסט
  let rawBody;
  try {
    rawBody = await readLimitedText(request, 4096);
  } catch {
    return new Response(JSON.stringify({ status: "error", reason: "payload_too_large" }), { status: 413, headers: jsonHeaders });
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ status: "error", reason: "bad_request" }), { status: 400, headers: jsonHeaders });
  }

  // מוודאים שהשדה בכלל מחרוזת לפני .trim() - קלט JSON זדוני יכול לשלוח למשל מספר או
  // אובייקט במקום טקסט, וזה היה גורם לשגיאת שרת (500) במקום דחייה מסודרת (400)
  if (typeof body.text !== "string") {
    return new Response(JSON.stringify({ status: "error", reason: "bad_request" }), { status: 400, headers: jsonHeaders });
  }

  const text = body.text.trim();
  const turnstileToken = body.turnstileToken || "";
  const clientId = (body.clientId || "unknown").toString().slice(0, 64);

  if (!text || text.length > 400) {
    return new Response(JSON.stringify({ status: "error", reason: "invalid_length" }), { status: 400, headers: jsonHeaders });
  }

  // שלב 1: אימות אנושיות (Turnstile) - נבדק כאן, בצד השרת, ולא רק בדפדפן.
  // מאמתים גם hostname וגם action, לא רק success - כדי שטוקן שנוצר באתר/הקשר אחר לא יתקבל כאן.
  const ip = request.headers.get("CF-Connecting-IP") || "0.0.0.0";
  const expectedHostname = hostnameFromOrigin(env.ALLOWED_ORIGIN);
  const turnstileOk = await verifyTurnstile(turnstileToken, ip, env.TURNSTILE_SECRET, expectedHostname);
  if (!turnstileOk) {
    return new Response(JSON.stringify({ status: "error", reason: "human_check_failed" }), { status: 400, headers: jsonHeaders });
  }

  // שלב 2: הגבלת קצב - מזהה מכשיר אנונימי (מגיע מהדפדפן) + קוד יומי שנגזר מה-IP (לא ה-IP עצמו).
  // חשוב לדעת: קריאה+כתיבה ל-KV כאן אינה אטומית (יש חלון זמן קטן בין ה-get וה-put),
  // כך שבזמן הצפה ממש מהירה מאותו מקור אפשר תיאורטית לעקוף חלק מהמכסה. זו הגנה סבירה
  // לתקופת ניסוי, לא חסימה קשיחה נגד מתקפה ממוקדת - אם זה יהפוך לבעיה אמיתית, הפתרון
  // הנכון הוא Durable Object ייעודי למונה (עם עדכון אטומי), לא KV.
  const today = new Date().toISOString().slice(0, 10);
  const ipHash = await hashValue(`${ip}|${today}|${env.IP_HASH_SALT}`);

  const perClientKey = `rl:${clientId}:${ipHash}`;
  const perIpKey = `rl-ip:${ipHash}`;

  const clientCount = parseInt((await env.RATE_LIMIT.get(perClientKey)) || "0", 10);
  if (clientCount >= 5) {
    return new Response(JSON.stringify({ status: "error", reason: "rate_limited" }), { status: 429, headers: jsonHeaders });
  }

  // חסימה מחמירה יותר רק כשקצב חריג מאוד מאותו קוד IP יומי (הצפה/בוט), לא ממשתמש בודד
  const ipCount = parseInt((await env.RATE_LIMIT.get(perIpKey)) || "0", 10);
  if (ipCount >= 60) {
    return new Response(JSON.stringify({ status: "error", reason: "rate_limited_strict" }), { status: 429, headers: jsonHeaders });
  }

  await env.RATE_LIMIT.put(perClientKey, String(clientCount + 1), { expirationTtl: 3600 });
  await env.RATE_LIMIT.put(perIpKey, String(ipCount + 1), { expirationTtl: 3600 });

  // שלב 3: מודרציה מול OpenAI, לפי מדיניות מותאמת אישית (לא ברירת המחדל הכללית שלהם)
  const moderation = await moderateText(text, env.OPENAI_API_KEY);
  if (!moderation.allowed) {
    return new Response(JSON.stringify({ status: "blocked", reason: moderation.reason }), { headers: jsonHeaders });
  }

  // שלב 4: שמירה זמנית ב-D1
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO messages (id, content, created_at) VALUES (?, ?, ?)")
    .bind(id, text, Date.now())
    .run();

  return new Response(JSON.stringify({ status: "published" }), { headers: jsonHeaders });
}

async function hashValue(input) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// קוראים את גוף הבקשה בזרימה, בייטים ספורים בכל פעם, וזורקים ברגע שחוצים את המגבלה -
// כך גוף בקשה ענק לא נטען כולו לזיכרון לפני שנדחה
async function readLimitedText(request, maxBytes) {
  const reader = request.body.getReader();
  let received = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      reader.cancel();
      throw new Error("payload_too_large");
    }
    chunks.push(value);
  }
  const combined = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(combined);
}

function hostnameFromOrigin(origin) {
  try {
    return new URL(origin).hostname;
  } catch {
    return null;
  }
}

async function verifyTurnstile(token, ip, secret, expectedHostname) {
  if (!token) return false;
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  form.append("remoteip", ip);

  let data;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
    });
    data = await res.json();
  } catch {
    // תקלת רשת/תקלה מול Cloudflare - עדיף לחסום ולא לאשר בטעות
    return false;
  }

  if (!data.success) return false;
  if (expectedHostname && data.hostname !== expectedHostname) return false;
  // הווידג'ט בעמוד מוגדר עם data-action="post_message" - דורשים שה-action יהיה בדיוק זה,
  // ולא רק בודקים אותו כשהוא קיים. כך טוקן בלי action בכלל (שלא נוצר דרך הווידג'ט שלנו) נדחה גם הוא.
  if (data.action !== "post_message") return false;

  return true;
}

async function moderateText(text, apiKey) {
  // /v1/moderations עם omni-moderation-latest - חינמי לגמרי (בשונה מ-chat completions).
  // המודל הזה מאומן להבדיל בין קללה/ביקורת רגילה לבין תוכן שבאמת מזיק,
  // ולכן ברוב המקרים הוא לא יחסום סתם "האתר חרא" - רק תוכן שנכנס לקטגוריות למטה.
  const res = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "omni-moderation-latest",
      input: text,
    }),
  });

  if (!res.ok) {
    // אם יש תקלה מול OpenAI - עדיף לחסום ולא לפרסם בטעות
    return { allowed: false, reason: "moderation_error" };
  }

  const data = await res.json();
  const result = data.results && data.results[0];
  if (!result) {
    return { allowed: false, reason: "moderation_error" };
  }

  const c = result.categories || {};

  // מיפוי מכוון של הקטגוריות המובנות של OpenAI למדיניות שלנו - לא כל קטגוריה שקיימת,
  // רק אלה שבאמת תואמות למה שרצינו לחסום. בכוונה לא משתמשים כאן ב-c.harassment
  // וב-c.violence "הפשוטים": הם תופסים גם עלבונות בוטים וגם דיון לגיטימי על אלימות,
  // וזה סותר את החופש שרצינו במרחב. באותה סיבה גם c.illicit לא בשימוש - הוא עלול
  // לחסום שיחה לימודית לגיטימית על אבטחה ופשיעה, בדיוק הנושא של האתר.
  //
  // ידוע וחסר בכוונה, שתי מגבלות אמיתיות לעקוב אחריהן בתקופת הניסוי:
  // 1) אין הגנה מפני דוקסינג (חשיפת פרטים מזהים) - זו לא קטגוריה שקיימת ב-omni-moderation.
  // 2) אין למודל קטגוריה נפרדת ל"הסתה לאלימות" - ההבחנה בין איום/הסתה אמיתיים לבין
  //    דיון לגיטימי על אלימות אינה אמינה כרגע, ולכן בכוונה לא חוסמים לפי c.violence
  //    (ראו למעלה). זה עלול להשאיר הסתה לאלימות שאינה גם גזענית/מאיימת-אישית לא-חסומה.

  // גזענות/שנאה - נחסם תמיד, גם בלי איום ישיר
  if (c.hate || c["hate/threatening"]) return { allowed: false, reason: "racism" };

  // איום ממשי על אדם - רק הקטגוריה ה"מאיימת" הספציפית, לא הטרדה כללית
  if (c["harassment/threatening"]) return { allowed: false, reason: "threat" };

  // פגיעה עצמית - חוסמים רק הוראות/עידוד ממשי, לא אדם שמבטא מצוקה או מבקש עזרה
  if (c["self-harm/instructions"]) return { allowed: false, reason: "self_harm_instructions" };

  // הגנת קטינים - קו אדום קבוע
  if (c["sexual/minors"]) return { allowed: false, reason: "sexual_minors" };

  return { allowed: true, reason: "none" };
}
