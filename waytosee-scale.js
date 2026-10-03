// ===== קנה מידה למסכי מחשב רחבים (מערכת העצבים המרכזית) =====
// במסך מחשב רחב מ-WTS_BASE_WIDTH פיקסלים, כל העמוד גדל באותו יחס (zoom),
// כך שהוא נראה בדיוק כמו במסך של 24 אינץ', רק גדול יותר.
// טלפונים, טאבלטים ולפטופים (מסכים צרים יותר, או מסך מגע) לא מושפעים.
//
// הקובץ נטען אוטומטית מתוך waytosee.js, ובעמודים שלא טוענים את waytosee.js
// (כמו דף הבית) הוא נטען ישירות ב-<head>.
//
// למה יש כאן יותר מ-zoom אחד: יחידות של גובה/רוחב מסך (vh, vw) גדלות גם הן
// עם ה-zoom, ואז 100vh היה יוצא גבוה מהמסך. לכן כל ערך כזה בעיצוב מחולק
// אוטומטית ב-zoom, וכך הוא נשאר בדיוק בגודל המסך.
(function scaleWideScreens() {
  if (window.__wtsScaleReady) return;
  window.__wtsScaleReady = true;

  const WTS_BASE_WIDTH = 1920;
  const root = document.documentElement;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const VIEWPORT_UNIT = /(-?\d*\.?\d+)(s|l|d)?(vw|vh|vmin|vmax)\b/g;
  const FIX = "calc($& / var(--wts-zoom, 1))";
  let active = false;

  function fixValue(value) {
    return value.replace(VIEWPORT_UNIT, (m) => FIX.replace("$&", m));
  }
  function fixStyle(style) {
    for (let i = 0; i < style.length; i++) {
      const prop = style[i];
      const val = style.getPropertyValue(prop);
      if (val && /v(w|h|min|max)\b/.test(val) && !val.includes("--wts-zoom")) {
        style.setProperty(prop, fixValue(val), style.getPropertyPriority(prop));
      }
    }
  }
  function fixRules(rules) {
    for (const rule of rules) {
      if (rule.style) fixStyle(rule.style);
      if (rule.cssRules) fixRules(rule.cssRules);
    }
  }
  function fixSheets() {
    for (const sheet of document.styleSheets) {
      if (sheet.__wtsFixed) continue;
      try { fixRules(sheet.cssRules); sheet.__wtsFixed = true; } catch (e) { /* גופנים מגוגל וכו' */ }
    }
  }
  function fixElement(el) {
    if (el.nodeType !== 1) return;
    if (el.style && el.getAttribute("style") && /v(w|h|min|max)\b/.test(el.getAttribute("style"))) fixStyle(el.style);
    el.querySelectorAll && el.querySelectorAll("[style]").forEach((child) => {
      if (/v(w|h|min|max)\b/.test(child.getAttribute("style"))) fixStyle(child.style);
    });
  }
  function startFixing() {
    if (active) return;
    active = true;
    fixSheets();
    fixElement(document.documentElement);
    new MutationObserver((list) => {
      for (const m of list) {
        if (m.type === "childList") m.addedNodes.forEach(fixElement);
        else if (m.type === "attributes") fixElement(m.target);
      }
      fixSheets();
    }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["style"] });
    window.addEventListener("load", fixSheets);
  }

  function apply() {
    const width = window.innerWidth;
    const zoom = finePointer.matches && width > WTS_BASE_WIDTH ? width / WTS_BASE_WIDTH : 1;
    root.style.zoom = zoom === 1 ? "" : zoom;
    root.style.setProperty("--wts-zoom", zoom);
    if (zoom !== 1) {
      startFixing();
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startFixing);
      fixSheets();
    }
  }
  apply();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { fixSheets(); fixElement(document.documentElement); });
  window.addEventListener("resize", apply);
})();
