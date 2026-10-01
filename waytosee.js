
document.addEventListener("DOMContentLoaded", () => {
  // רקע "גשם" עדין - רק בעמודים שכוללים ב-HTML <div class="rain" id="rain">.
  // ה-CSS (.rain / .drop / @keyframes rain) גר ב-waytosee.css; כאן רק יוצרים
  // את 150 הטיפות בפעם הראשונה שהעמוד נטען.
  const rainContainer = document.getElementById("rain");
  if (rainContainer && !rainContainer.dataset.waytoseeRainReady) {
    rainContainer.dataset.waytoseeRainReady = "true";
    for (let i = 0; i < 150; i++) {
      const drop = document.createElement("div");
      drop.classList.add("drop");
      drop.style.left = Math.random() * 100 + "vw";
      drop.style.top = Math.random() * -120 + "vh";
      drop.style.animationDuration = (5.2 + Math.random() * 7.2) + "s";
      drop.style.opacity = 0.07 + Math.random() * 0.14;
      drop.style.height = 46 + Math.random() * 95 + "px";
      drop.style.animationDelay = Math.random() * -8 + "s";
      rainContainer.appendChild(drop);
    }
  }

  const skipFocusSetup = window.waytoseeSkipFocusSetup === true;
  const mainScript =
    document.querySelector('script[src$="waytosee.js"]');
  const homeAddress = window.waytoseeHomeOverride || (mainScript
    ? new URL("index.html", mainScript.src).href
    : "../index.html");
  let homeButton = document.getElementById("homeBtn");
  if (!homeButton) {
    homeButton = document.createElement("a");
    homeButton.id = "homeBtn";
    document.body.appendChild(homeButton);
  }
  homeButton.innerHTML = `<svg viewBox="0 0 100 78" width="30" height="24" fill="currentColor" aria-hidden="true">
    <polygon class="home-seg home-seg-1" points="50.00,14.00 32.85,43.70 40.39,45.15 50.00,28.50"/>
    <polygon class="home-seg home-seg-2" points="21.42,63.50 55.72,63.50 53.20,56.25 33.98,56.25"/>
    <polygon class="home-seg home-seg-3" points="78.58,63.50 61.43,33.80 56.41,39.60 66.02,56.25"/>
  </svg>`;
  homeButton.href = homeAddress;

  // מפת ההורים של כל דף במבנה האתר - מרוכזת כאן במקום אחד ("מערכת העצבים
  // המרכזית") במקום שכל דף יצטרך להצהיר על ההורה שלו בנפרד. המפתח הוא
  // הנתיב היחסי לתיקיית השורש של האתר (איפה ש-waytosee.js נמצא, באותיות
  // קטנות), הערך הוא הנתיב היחסי לאותה תיקיית שורש של דף ה"הורה".
  const PARENT_MAP = {
    "professions.html": "index.html",
    "intro.html": "professions.html",
    "statistika/statistika.html": "professions.html",
    "statistika/statistika-introduction.html": "statistika/statistika.html",
    "statistika/statistika-scales.html": "statistika/statistika.html",
    "statistika/statistika-data-display.html": "statistika/statistika.html",
    "statistika/statistika-mode.html": "statistika/statistika.html",
    "statistika/statistika-relative.html": "statistika/statistika.html",
    "statistika/statistika-shape.html": "statistika/statistika.html",
    "statistika/statistika-dispersion.html": "statistika/statistika.html",
    "arp/arp.html": "intro.html",
    "tcp/tcp.html": "intro.html",
    "gateway/gateway.html": "intro.html",
    "icmp/icmp.html": "intro.html",
    "dhcp/dhcp.html": "intro.html",
    "ip/ip.html": "intro.html",
    "subnet/index.html": "intro.html",
    "nat/index.html": "intro.html",
    "internet/internet.html": "intro.html",
    "ccna-introduction/ccna-introduction.html": "intro.html",
  };

  // נתיב הדף הנוכחי יחסית לתיקיית השורש של האתר
  const rootDirURL = mainScript ? new URL(".", mainScript.src) : null;
  const currentRelativePath = rootDirURL
    ? decodeURIComponent(location.pathname.slice(rootDirURL.pathname.length)).toLowerCase()
    : "";

  // כפתור הבית עולה שלב אחד קבוע במבנה האתר (לא תלוי בהיסטוריית דפדפן,
  // כדי שזה יעבוד תמיד באותו אופן, גם אם נכנסו ישר לעמוד). ההורה נקבע
  // לפי PARENT_MAP למעלה, או לפי window.waytoseeParentOverride אם הוצהר
  // ידנית בעמוד מסוים (נתיב יחסי לשורש האתר). אם אין הורה ידוע - חוזרים
  // להיסטוריית הדפדפן כברירת מחדל (למשל בעמוד "המרחב").
  const parentRelativePath =
    window.waytoseeParentOverride || PARENT_MAP[currentRelativePath] || null;
  const parentAddress = parentRelativePath
    ? (rootDirURL ? new URL(parentRelativePath, rootDirURL).href : parentRelativePath)
    : null;
  homeButton.addEventListener("click", (e) => {
    e.preventDefault();
    if (parentAddress) {
      window.location.href = parentAddress;
    } else if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = homeAddress;
    }
  });

  const currentFile = (location.pathname.split("/").pop() || "").toLowerCase();

  // כפתור מעבר לעמוד "המרחב" - בכל עמוד חוץ מעמוד הנושאים (intro.html) ועמוד המקצועות (professions.html)
  // בתוך המרחב עצמו - אותו כפתור (שלוש הנקודות) נשאר מוצג, אבל לחיצה עליו חוזרת אחורה
  // בדיוק כמו כפתור הבית - כניסה למרחב ויציאה ממנו באותו כפתור
  if (currentFile !== "intro.html" && currentFile !== "professions.html") {
    let spaceButton = document.getElementById("spaceBtn");
    if (!spaceButton) {
      spaceButton = document.createElement("a");
      spaceButton.id = "spaceBtn";
      spaceButton.setAttribute("aria-label", "המרחב");
      spaceButton.innerHTML = `<svg viewBox="0 0 64 24" width="30" height="14" aria-hidden="true">
        <circle cx="10" cy="12" r="5" opacity="0.35"/>
        <circle cx="32" cy="12" r="5" opacity="0.65"/>
        <circle cx="54" cy="12" r="5" opacity="1"/>
      </svg>`;
      document.body.appendChild(spaceButton);
    }
    if (currentFile === "merchav.html") {
      spaceButton.href = homeAddress;
      spaceButton.addEventListener("click", (e) => {
        e.preventDefault();
        if (window.history.length > 1) {
          window.history.back();
        } else {
          window.location.href = homeAddress;
        }
      });
    } else {
      spaceButton.href = mainScript
        ? new URL("merchav.html", mainScript.src).href
        : "../merchav.html";
    }
  }

  if (skipFocusSetup) return;
  let focusButton = document.getElementById("focusBtn");
  if (!focusButton) {
    focusButton = document.createElement("button");
    focusButton.className = "focus-toggle";
    focusButton.id = "focusBtn";
    document.body.appendChild(focusButton);
  }
  const clefAddress = mainScript
    ? new URL("waytosee-clef.png", mainScript.src).href
    : "../waytosee-clef.png";
  focusButton.innerHTML = `<img src="${clefAddress}" alt="מפתח פה">`;
  let brownNoise = document.getElementById("brownNoise");
  if (!brownNoise) {
    brownNoise = document.createElement("audio");
    brownNoise.id = "brownNoise";
    brownNoise.loop = true;
    brownNoise.preload = "auto";
    const scriptPath = mainScript
      ? mainScript.getAttribute("src")
      : "../waytosee.js";
    brownNoise.src = scriptPath.replace("waytosee.js", "brown-noise.mp3");
    document.body.appendChild(brownNoise);
  }
  function fadeAudio(audio, targetVolume, duration) {
    const steps = 24;
    const startVolume = audio.volume;
    const difference = targetVolume - startVolume;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      audio.volume = Math.max(0, Math.min(1, startVolume + difference * (step / steps)));
      if (step >= steps) {
        clearInterval(interval);
        audio.volume = targetVolume;
        if (targetVolume === 0) {
          audio.pause();
        }
      }
    }, duration / steps);
  }
  function startBrownNoise() {
    if (!brownNoise) return;
    brownNoise.volume = 0;
    brownNoise
      .play()
      .then(() => {
        fadeAudio(brownNoise, 0.60, 1600);
      })
      .catch((error) => {
        console.warn("שגיאת שמע:", error.message, brownNoise.src);
      });
  }
  function stopBrownNoise() {
    if (!brownNoise) return;
    fadeAudio(brownNoise, 0, 900);
  }

  let flickerTimeout = null;

  function scheduleFlicker() {
    // .container - שם התוכן המרכזי ב-ARP/DHCP. .grid - אותו תפקיד ב-Subnet/NAT
    // (שם אחר בכוונה, כי הם שומרים על מערכת עיצוב משלהם).
    const container = document.querySelector(".container, .grid");
    if (!container) return;
    container.classList.add("turquoise-flash");
    setTimeout(() => container.classList.remove("turquoise-flash"), 200);
    const nextDelay = 2000 + Math.random() * 6000; // בין 2 ל-8 שניות
    flickerTimeout = setTimeout(scheduleFlicker, nextDelay);
  }

  function stopFlicker() {
    if (flickerTimeout) {
      clearTimeout(flickerTimeout);
      flickerTimeout = null;
    }
  }

  if (localStorage.getItem("waytoseeLearningMode") === "on") {
    document.body.classList.add("learning-mode");
    focusButton.classList.add("active");
    startBrownNoise();
    scheduleFlicker();
  }
  focusButton.addEventListener("click", () => {
    document.body.classList.toggle("learning-mode");
    const isLearningMode = document.body.classList.contains("learning-mode");
    focusButton.classList.toggle("active", isLearningMode);
    localStorage.setItem("waytoseeLearningMode", isLearningMode ? "on" : "off");
    if (isLearningMode) {
      startBrownNoise();
      scheduleFlicker();
    } else {
      stopBrownNoise();
      stopFlicker();
    }
  });
});
