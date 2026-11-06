// WayToSee | Google Analytics (מערכת העצבים המרכזית)
// כל הגדרות אנליטיקס של האתר נמצאות כאן, בקובץ אחד.
//
// החרגה של המכשירים שלי:
//   waytosee.io/?me     → הדפדפן הזה מפסיק להיספר
//   waytosee.io/?notme  → ביטול, הדפדפן נספר שוב
// כל דפדפן זוכר בנפרד (ספארי וכרום בטלפון = פעמיים).

(function () {
  var GA_ID = 'G-FTM28BMBXC';

  try {
    var q = new URLSearchParams(window.location.search);
    if (q.has('me')) localStorage.setItem('waytosee-me', '1');
    if (q.has('notme')) localStorage.removeItem('waytosee-me');
    if (localStorage.getItem('waytosee-me') === '1') {
      window['ga-disable-' + GA_ID] = true;
    }
  } catch (e) {}

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  gtag('js', new Date());
  gtag('config', GA_ID);
})();
