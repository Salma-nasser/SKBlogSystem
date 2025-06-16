import { Fireworks } from "https://esm.sh/fireworks-js@2.1.0";
window.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const username = params.get("username");

  if (username) {
    document.getElementById(
      "welcomeHeader"
    ).textContent = `Welcome, ${username}!`;
    setTimeout(() => {
      document.getElementById("welcomeHeader").classList.add("animate-to-top");
    }, 200); // Slight delay gives the browser time to render before animation starts
    const trailSparkles = () => {
      const sparkle = document.createElement("div");
      sparkle.className = "sparkle";
      const rect = document
        .getElementById("welcomeHeader")
        .getBoundingClientRect();
      sparkle.style.left = `${rect.left + rect.width / 2}px`;
      sparkle.style.top = `${rect.top + rect.height / 2}px`;
      document.body.appendChild(sparkle);
      setTimeout(() => sparkle.remove(), 800);
    };

    let sparkleInterval = setInterval(trailSparkles, 100);
    setTimeout(() => clearInterval(sparkleInterval), 1000); // Sparkle for 1 second

    setTimeout(
      () =>
        confetti({
          particleCount: 1200,
          spread: 120,
          origin: { y: 0.6 },
        }),
      2000
    );

    setTimeout(() => {
      const container = document.getElementById("fireworks-container");
      const fireworks = new Fireworks(container, {
        speed: 4,
        acceleration: 1.05,
        friction: 0.97,
        gravity: 1.5,
        particles: 70,
        trace: 5,
        explosion: 6,
        autoresize: true,
        brightness: {
          min: 50,
          max: 80,
          decay: { min: 0.015, max: 0.03 },
        },
        boundaries: {
          top: 50,
          bottom: window.innerHeight - 50,
          left: 50,
          right: window.innerWidth - 50,
        },
      });

      fireworks.start();
      setTimeout(() => fireworks.stop(), 10000);
    }, 5000); // 5 seconds delay for fireworks to start after welcome message
  }
  document.getElementById("logoutBtn").addEventListener("click", () => {
    window.location.href = "login.html";
  });
});
const modeToggle = document.getElementById("modeToggle");

modeToggle.addEventListener("click", () => {
  modeToggle.classList.add("flipping");

  setTimeout(() => {
    document.body.classList.toggle("dark-mode");
    const isDark = document.body.classList.contains("dark-mode");
    modeToggle.textContent = isDark ? "☀️" : "🌙";
    modeToggle.setAttribute("data-theme", isDark ? "light" : "dark");
  }, 150); // Swap mid-flip

  setTimeout(() => modeToggle.classList.remove("flipping"), 600);
});
