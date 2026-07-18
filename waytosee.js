document.addEventListener("DOMContentLoaded", () => {
  /*
    יצירת כתובת נכונה לדף הבית.
    כך הכפתור יעבוד גם מתוך תיקיות פנימיות.
  */
  const mainScript =
    document.querySelector('script[src$="waytosee.js"]');

  const homeAddress = mainScript
    ? new URL("index.html", mainScript.src).href
    : "../index.html";

  /*
    כפתור דו – חזרה לדף הבית
  */
  let homeButton = document.getElementById("homeBtn");

  if (!homeButton) {
    homeButton = document.createElement("a");
    homeButton.id = "homeBtn";
    document.body.appendChild(homeButton);
  }

  homeButton.textContent = "道";
  homeButton.href = homeAddress;
  homeButton.title = "חזרה לדף הבית";

  /*
    כפתור מפתח פה – תודעת לימוד
  */
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

focusButton.innerHTML =
  `<img src="${clefAddress}" alt="מפתח פה">`;
  focusButton.title = "כניסה לתודעת לימוד";

  /*
  רעש חום – נוצר אוטומטית בכל עמוד
*/
let brownNoise = document.getElementById("brownNoise");

if (!brownNoise) {
  brownNoise = document.createElement("audio");
  brownNoise.id = "brownNoise";
  brownNoise.loop = true;
  brownNoise.preload = "auto";

  const scriptPath = mainScript
  ? mainScript.getAttribute("src")
  : "../waytosee.js";

brownNoise.src =
  scriptPath.replace("waytosee.js", "brown-noise.mp3");

  document.body.appendChild(brownNoise);
}

  function fadeAudio(audio, targetVolume, duration) {
    const steps = 24;
    const startVolume = audio.volume;
    const difference = targetVolume - startVolume;
    let step = 0;

    const interval = setInterval(() => {
      step++;

      audio.volume = Math.max(
        0,
        Math.min(
          1,
          startVolume + difference * (step / steps)
        )
      );

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
  alert(
    "שגיאת שמע: " + error.message +
    "\n\nכתובת הקובץ:\n" + brownNoise.src
  );
});
  }

  function stopBrownNoise() {
    if (!brownNoise) return;

    fadeAudio(brownNoise, 0, 900);
  }

  focusButton.addEventListener("click", () => {
    document.body.classList.toggle("learning-mode");

    const isLearningMode =
      document.body.classList.contains("learning-mode");

    focusButton.classList.toggle("active", isLearningMode);
    

    focusButton.title = isLearningMode
      ? "יציאה מתודעת לימוד"
      : "כניסה לתודעת לימוד";

    if (isLearningMode) {
      startBrownNoise();
    } else {
      stopBrownNoise();
    }
  });
});