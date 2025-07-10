export function initializeThemeToggle(toggleButtonId = "modeToggle") {
  const modeToggle = document.getElementById(toggleButtonId);

  if (!modeToggle) {
    console.warn(`Theme toggle button with ID "${toggleButtonId}" not found`);
    return;
  }

  const savedTheme = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  // Initialize theme based on saved preference or system preference
  const isDark = savedTheme === "dark" || (!savedTheme && prefersDark);

  if (isDark) {
    document.body.classList.add("dark-mode");
    modeToggle.setAttribute("data-theme", "dark");
    modeToggle.textContent = "🌙";
  } else {
    document.body.classList.remove("dark-mode");
    modeToggle.setAttribute("data-theme", "light");
    modeToggle.textContent = "☀️";
  }

  // Add click handler
  modeToggle.addEventListener("click", () => {
    const isDarkMode = document.body.classList.toggle("dark-mode");
    modeToggle.setAttribute("data-theme", isDarkMode ? "dark" : "light");
    modeToggle.textContent = isDarkMode ? "🌙" : "☀️";
    localStorage.setItem("theme", isDarkMode ? "dark" : "light");
  });
}
