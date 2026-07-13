document.addEventListener("DOMContentLoaded", () => {
  const focusButton = document.createElement("button");

  focusButton.className = "focus-toggle";
  focusButton.id = "focusBtn";
  focusButton.textContent = "𝄢";
  focusButton.title = "כניסה לתודעת לימוד";

  document.body.appendChild(focusButton);
  const brownNoise = document.getElementById("brownNoise");
  function fadeAudio(audio, targetVolume, duration) {
  const steps = 24;
  const startVolume = audio.volume || 0;
  const diff = targetVolume - startVolume;
  let step = 0;

  const interval = setInterval(() => {
    step++;

    audio.volume = Math.max(
      0,
      Math.min(1, startVolume + diff * (step / steps))
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

  brownNoise.play().then(() => {
    fadeAudio(brownNoise, 0.16, 1600);
  }).catch(() => {});
}

function stopBrownNoise() {
  if (!brownNoise) return;

  fadeAudio(brownNoise, 0, 900);
}

  focusButton.addEventListener("click", () => {
    document.body.classList.toggle("learning-mode");

    const isLearningMode =
      document.body.classList.contains("learning-mode");

    if (isLearningMode) {
  startBrownNoise();
} else {
  stopBrownNoise();
}

    focusButton.textContent = "𝄢";
    focusButton.title = isLearningMode
      ? "יציאה מתודעת לימוד"
      : "כניסה לתודעת לימוד";
  });
});
