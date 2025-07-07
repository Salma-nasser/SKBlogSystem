export function initializeThemeToggle(toggleButtonId = "modeToggle") {
  const modeToggle = document.getElementById(toggleButtonId);
  const savedTheme = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
    document.body.classList.add("dark-mode");
    modeToggle?.setAttribute("data-theme", "dark");
    modeToggle.textContent = "🌙";
  } else {
    modeToggle?.setAttribute("data-theme", "light");
    modeToggle.textContent = "☀️";
  }

  modeToggle?.addEventListener("click", () => {
    const isDark = document.body.classList.toggle("dark-mode");
    modeToggle.setAttribute("data-theme", isDark ? "dark" : "light");
    modeToggle.textContent = isDark ? "🌙" : "☀️";
    localStorage.setItem("theme", isDark ? "dark" : "light");
  });
}
