
document.addEventListener("DOMContentLoaded", () => {
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
    <polygon points="50.00,14.00 32.85,43.70 40.39,45.15 50.00,28.50" opacity="1"/>
    <polygon points="21.42,63.50 55.72,63.50 53.20,56.25 33.98,56.25" opacity="0.55"/>
    <polygon points="78.58,63.50 61.43,33.80 56.41,39.60 66.02,56.25" opacity="0.78"/>
  </svg>`;
  homeButton.href = homeAddress;
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
    const container = document.querySelector(".container");
    if (!container) return;
    container.classList.add("turquoise-flash");
    setTimeout(() => container.classList.remove("turquoise-flash"), 300);
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
 