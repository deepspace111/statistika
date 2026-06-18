document.addEventListener("DOMContentLoaded", () => {
  const focusButton = document.querySelector(".focus-toggle");

  if (!focusButton) return;

  function updateFocusButton() {
    const isFocus = document.body.classList.contains("focus-mode");

    if (isFocus) {
      focusButton.textContent = "𝄢";
      focusButton.setAttribute("title", "יציאה מתודעת לימוד");
    } else {
      focusButton.textContent = "תודעת לימוד";
      focusButton.setAttribute("title", "כניסה לתודעת לימוד");
    }
  }

  focusButton.addEventListener("click", () => {
    document.body.classList.toggle("focus-mode");
    updateFocusButton();
  });

  updateFocusButton();
});
