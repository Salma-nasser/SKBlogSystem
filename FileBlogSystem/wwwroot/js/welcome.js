// Fetch and render latest published posts onto the welcome page
import { renderPosts } from "/js/utils/renderPost.js";
import { initializeThemeToggle } from "/js/utils/themeToggle.js";
import { initMobileSidebar } from "/js/utils/mobileSidebar.js";
import { showAuthPrompt } from "/js/utils/notifications.js";

async function fetchLatest() {
  try {
    const res = await fetch("/api/posts/published");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const posts = await res.json();
    // Sort newest first and take top 6
    const latest = posts
      .sort((a, b) => new Date(b.PublishedDate) - new Date(a.PublishedDate))
      .slice(0, 6);

    // Render with minimal actions and show author
    renderPosts(latest, "latestPosts", {
      showDelete: false,
      showModify: false,
      showAuthor: true,
      showActions: false,
    });
  } catch (err) {
    console.error("Failed to load latest posts:", err);
    const container = document.getElementById("latestPosts");
    if (container) {
      container.innerHTML = `<p style="text-align:center; color: var(--text-muted);">Unable to load posts right now.</p>`;
    }
  }
}

// Kick off
fetchLatest();
initializeThemeToggle();
initMobileSidebar();

// If guest clicks any profile link, prompt to register/sign in
document.addEventListener("click", (e) => {
  const target = e.target.closest('a[href^="/profile/"]');
  if (!target) return;
  const hasToken = !!localStorage.getItem("jwtToken");
  if (!hasToken) {
    e.preventDefault();
    showAuthPrompt({
      message:
        "Sign in or create an account to view user profiles and follow authors.",
    });
  }
});
