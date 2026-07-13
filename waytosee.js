document.addEventListener("DOMContentLoaded", () => {
  let focusButton = document.getElementById("focusBtn");

  if (!focusButton) {
    focusButton = document.createElement("button");
    focusButton.className = "focus-toggle";
    focusButton.id = "focusBtn";
    document.body.appendChild(focusButton);
  }

  focusButton.textContent = "𝄢";
  focusButton.title = "כניסה לתודעת לימוד";

  const brownNoise = document.getElementById("brownNoise");

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
        fadeAudio(brownNoise, 0.16, 1600);
      })
      .catch(() => {});
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

    focusButton.textContent = "𝄢";

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
