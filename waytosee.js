document.addEventListener("DOMContentLoaded", () => {
  const focusButton = document.createElement("button");

  focusButton.className = "focus-toggle";
  focusButton.id = "focusBtn";
  focusButton.textContent = "𝄢";
  focusButton.title = "כניסה לתודעת לימוד";

  document.body.appendChild(focusButton);

  focusButton.addEventListener("click", () => {
    document.body.classList.toggle("learning-mode");

    const isLearningMode =
      document.body.classList.contains("learning-mode");

    focusButton.textContent = "𝄢";
    focusButton.title = isLearningMode
      ? "יציאה מתודעת לימוד"
      : "כניסה לתודעת לימוד";
  });
});
