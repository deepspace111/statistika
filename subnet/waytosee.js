document.addEventListener("DOMContentLoaded", () => {
  const focusButton = document.querySelector(".focus-toggle");
  if (!focusButton) return;

  function updateFocusButton() {
    const isFocus = document.body.classList.contains("focus-mode");
    focusButton.innerHTML = isFocus ? "𝄢" : "תודעת לימוד";
  }

  focusButton.onclick = () => {
    document.body.classList.toggle("focus-mode");
    updateFocusButton();
  };

  updateFocusButton();
});ד
