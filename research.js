// שלוחת המחקר - נטענת רק בדפי המחקר, בנוסף ל-waytosee.js.
// כל מה שמיוחד לפרק המחקר נכנס לכאן, בלי לגעת בשאר האתר.

// שורת הזכויות: כל עמוד מחקר קובע בעצמו את השם, דרך data-copyright ב-<body>.
// למשל: <body data-copyright="WayToSee">. עמוד שלא קבע - נשאר WayToHear, כמו קודם.
window.waytoseeCopyrightOwner =
  (document.body && document.body.dataset.copyright) || "WayToHear";
