import { renderPosts } from "./utils/renderPost.js";
import { initializeImageModal, openImageModal } from "./utils/imageModal.js";
import { initializeThemeToggle } from "./utils/themeToggle.js";
import { showMessage } from "./utils/notifications.js";
import { authenticatedFetch } from "./utils/api.js";
let currentPage = 1;
const pageSize = 5;
let allPosts = [];
let activeFilter = null; // { type: "tag"|"category", value: "..." }

// URL Pagination utilities
function getPageFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  const page = parseInt(urlParams.get("page")) || 1;
  return Math.max(1, page);
}

function updateURL(page) {
  const url = new URL(window.location);
  if (page === 1) {
    url.searchParams.delete("page");
  } else {
    url.searchParams.set("page", page);
  }
  window.history.pushState({}, "", url);
}

function initializePageFromURL() {
  currentPage = getPageFromURL();
}

const clearFilterBtn = document.getElementById("clearFilterBtn");
initializeImageModal();
initializeThemeToggle();
window.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("jwtToken");
  if (!token) {
    return (window.location.href = "login");
  }
  const logoutBtn = document.querySelector(
    'a[href="/logout"], .header-buttons .btn[href="/logout"]'
  );
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function (e) {
      localStorage.removeItem("jwtToken");
      localStorage.removeItem("username");
    });
  }
  // Initialize page from URL
  initializePageFromURL();

  // Handle browser back/forward navigation
  window.addEventListener("popstate", () => {
    currentPage = getPageFromURL();
    reloadPosts();
  });

  // Navigate to the create post page
  document.getElementById("newPostBtn")?.addEventListener("click", () => {
    window.location.href = "/create-post";
  });

  // ---------- VIEW PROFILE ----------
  document.getElementById("profileBtn")?.addEventListener("click", () => {
    window.location.href = "/profile/" + localStorage.getItem("username");
  });

  // ---------- USER INFO & LOGOUT ----------
  const username = localStorage.getItem("username");
  const usernameSpan = document.getElementById("username");
  if (usernameSpan && username) {
    usernameSpan.textContent = username;
  }
  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    localStorage.removeItem("jwtToken");
    localStorage.removeItem("username");
    window.location.href = "/login";
  });

  // ---------- ADMIN BUTTON FOR ADMIN USERS ----------
  const adminBtn = document.getElementById("adminBtn");
  console.log("DEBUG: Admin button element found:", !!adminBtn);

  if (adminBtn) {
    // Check if user is admin
    const token = localStorage.getItem("jwtToken");
    console.log("DEBUG: JWT Token exists:", !!token);

    if (token) {
      try {
        // Parse JWT to get role
        const base64Url = token.split(".")[1];
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split("")
            .map(function (c) {
              return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
            })
            .join("")
        );
        const payload = JSON.parse(jsonPayload);

        console.log("DEBUG: JWT Payload:", payload);

        // Check both possible claim names for role
        const userRole =
          payload.role ||
          payload[
            "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"
          ];
        console.log("DEBUG: User Role:", userRole);

        if (userRole === "Admin") {
          console.log("DEBUG: User is Admin - showing admin button");
          adminBtn.style.display = "inline-block";
          adminBtn.addEventListener("click", () => {
            console.log(
              "DEBUG: Admin button clicked - redirecting to admin page"
            );
            window.location.href = "/admin";
          });
        } else {
          console.log("DEBUG: User is not Admin - hiding admin button");
          adminBtn.style.display = "none";
        }
      } catch (error) {
        console.error("DEBUG: Error parsing JWT:", error);
        adminBtn.style.display = "none";
      }
    } else {
      console.log("DEBUG: No JWT token - hiding admin button");
      adminBtn.style.display = "none";
    }
  }

  // ---------- SEARCH & PAGINATION ----------
  document.getElementById("searchInput")?.addEventListener("input", () => {
    currentPage = 1;
    updateURL(currentPage);
    reloadPosts();
  });
  document.getElementById("prevPage")?.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      updateURL(currentPage);
      reloadPosts();
    }
  });
  document.getElementById("nextPage")?.addEventListener("click", () => {
    currentPage++;
    updateURL(currentPage);
    reloadPosts();
  });

  // ---------- CLEAR FILTER ----------
  clearFilterBtn?.addEventListener("click", () => {
    activeFilter = null;
    currentPage = 1;
    updateURL(currentPage);
    document
      .querySelectorAll(".clickable-tag")
      .forEach((el) => el.classList.remove("active-filter"));

    document.getElementById("clearFilterBtn").style.visibility = "hidden";
    reloadPosts();
  });

  // ---------- TAG/CATEGORY CLICK DELEGATION ----------
  document.addEventListener("click", async (e) => {
    const el = e.target;
    if (el.classList.contains("clickable-tag")) {
      // highlight
      document
        .querySelectorAll(".clickable-tag")
        .forEach((b) => b.classList.remove("active-filter"));
      el.classList.add("active-filter");

      // Make "Show All Posts" button visible
      document.getElementById("clearFilterBtn").style.visibility = "visible";
      document.getElementById("clearFilterBtn").style.display = "inline-block";

      activeFilter = {
        type: el.dataset.type,
        value: el.dataset.value,
      };
      currentPage = 1;
      updateURL(currentPage);
      await reloadPosts();
    }
  });

  // ---------- INITIAL POSTS LOAD ----------
  reloadPosts();
  // Start notification panel polling after DOM is ready
  getAllNotifications();

  // Patch like button handler to refresh notifications after like
  document.body.addEventListener("click", async (e) => {
    if (e.target.classList.contains("like-toggle")) {
      // Wait a moment for backend to process, then refresh notifications
      setTimeout(getAllNotifications, 500);
    }
  });
});

// ---------- SHARED HELPERS ----------

async function reloadPosts() {
  let posts;

  try {
    if (!activeFilter) {
      const res = await authenticatedFetch("/api/posts");
      posts = await res.json();
      allPosts = posts;
    } else {
      // Use correct API path for filtered posts
      const urlBase = `/api/posts/${activeFilter.type}/${encodeURIComponent(
        activeFilter.value
      )}`;
      const res = await authenticatedFetch(urlBase);
      posts = await res.json();
    }
  } catch (error) {
    if (error.message !== "Session expired") {
      console.error("Failed to reload posts:", error);
      showMessage("Could not load posts.", "error");
    }
    return; // Stop execution if fetch fails
  }

  // apply client‐side search, publish & schedule filters
  const searchQuery =
    document.getElementById("searchInput")?.value.trim().toLowerCase() || "";
  const now = new Date();

  const filtered = posts.filter((post) => {
    const sched = post.ScheduledDate ? new Date(post.ScheduledDate) : null;
    const matchesSearch =
      post.Title.toLowerCase().includes(searchQuery) ||
      post.Description.toLowerCase().includes(searchQuery) ||
      post.Tags.some((t) => t.toLowerCase().includes(searchQuery)) ||
      post.Categories.some((c) => c.toLowerCase().includes(searchQuery));

    return post.IsPublished && (!sched || sched <= now) && matchesSearch;
  });

  // render + pagination update
  renderPosts(paginate(filtered, currentPage, pageSize), "postsContainer", {
    showDelete: false,
    showModify: false,
  });
  updatePagination(filtered.length);
}

function paginate(items, page, size) {
  const start = (page - 1) * size;
  return items.slice(start, start + size);
}

function updatePagination(totalItems) {
  const totalPages = Math.max(Math.ceil(totalItems / pageSize), 1);

  // Ensure currentPage is within valid range
  if (currentPage > totalPages) {
    currentPage = totalPages;
    updateURL(currentPage);
  }

  const info = document.getElementById("pageInfo");
  const prevButton = document.getElementById("prevPage");
  const nextButton = document.getElementById("nextPage");
  if (info) {
    info.textContent = `Page ${currentPage} of ${totalPages}`;
  }
  if (prevButton) {
    prevButton.disabled = currentPage === 1;
  }
  if (nextButton) {
    nextButton.disabled = currentPage === totalPages;
  }
}

document.body.addEventListener("click", (e) => {
  if (e.target.classList.contains("post-image")) {
    const postCard = e.target.closest(".post-card");
    const images = Array.from(postCard.querySelectorAll(".post-image")).map(
      (img) => img.src
    );
    const clickedIndex = images.indexOf(e.target.src);

    openImageModal(images, clickedIndex);
  }
});
// === NOTIFICATIONS PANEL ===
// === NOTIFICATIONS DROPDOWN ===
function createNotificationsDropdown() {
  let dropdown = document.getElementById("notificationsDropdown");
  if (!dropdown) {
    dropdown = document.createElement("div");
    dropdown.id = "notificationsDropdown";
    dropdown.style.position = "absolute";
    dropdown.style.top = "56px";
    dropdown.style.right = "32px";
    dropdown.style.width = "340px";
    dropdown.style.maxHeight = "70vh";
    dropdown.style.overflowY = "auto";
    dropdown.style.background = "#fff8e1";
    dropdown.style.border = "1px solid #d4c4b0";
    dropdown.style.borderRadius = "12px";
    dropdown.style.boxShadow = "0 2px 16px rgba(139,69,19,0.10)";
    dropdown.style.padding = "18px 18px 8px 18px";
    dropdown.style.zIndex = 100;
    dropdown.style.display = "none";
    dropdown.innerHTML = `<h3 style='margin-top:0;margin-bottom:12px;color:#8b4513;font-size:1.2rem;'>Notifications</h3><div id="notificationsList"></div>`;
    document.body.appendChild(dropdown);
  }
}

async function getAllNotifications() {
  try {
    const res = await authenticatedFetch("/notifications?all=true");
    const notifications = await res.json();
    renderNotificationsDropdown(notifications);
    // Update unread count badge
    const badge = document.getElementById("bellUnreadCount");
    if (badge) {
      const unreadCount = notifications.filter((n) => !n.IsRead).length;
      if (unreadCount > 0) {
        badge.textContent = unreadCount > 99 ? "99+" : unreadCount;
        badge.style.display = "inline-block";
      } else {
        badge.style.display = "none";
      }
    }
  } catch (e) {
    if (e.message !== "Session expired") {
      console.error("Failed to get notifications:", e);
    }
  }
}

// Render notifications in dropdown
function renderNotificationsDropdown(notifications) {
  createNotificationsDropdown();
  const dropdown = document.getElementById("notificationsDropdown");
  const list = document.getElementById("notificationsList");
  if (!list) return;
  list.innerHTML = "";
  if (!notifications || notifications.length === 0) {
    list.innerHTML = `<div style='color:#8a7a6e;'>No notifications yet.</div>`;
    return;
  }
  notifications.forEach((n) => {
    const notif = document.createElement("div");
    notif.className = "notification-item";
    notif.style.background = "#ffe4b5";
    notif.style.color = "#2c1810";
    notif.style.borderRadius = "7px";
    notif.style.padding = "10px 12px";
    notif.style.marginBottom = "10px";
    notif.style.fontSize = "0.98rem";
    notif.style.borderLeft = n.IsRead ? "none" : "4px solid #8b4513";
    notif.innerHTML = `<span>${
      n.Message
    }</span><br><span style='font-size:0.8em;color:#8a7a6e;'>${new Date(
      n.CreatedAt
    ).toLocaleString()}</span>`;
    if (!n.IsRead) {
      notif.style.cursor = "pointer";
      notif.addEventListener("click", async (e) => {
        e.stopPropagation();
        try {
          await authenticatedFetch(`/notifications/read/${n.Id}`, {
            method: "POST",
          });
          getAllNotifications();
        } catch (error) {
          console.error("Error marking notification as read:", error);
          // Re-enable interaction on error
          notif.style.pointerEvents = "";
        }
      });
    }
    list.appendChild(notif);
  });
}
// Show/hide dropdown on bell click
document.addEventListener("DOMContentLoaded", () => {
  const bell = document.getElementById("notificationBell");
  createNotificationsDropdown();
  if (bell) {
    bell.addEventListener("click", (e) => {
      e.stopPropagation();
      const dropdown = document.getElementById("notificationsDropdown");
      if (dropdown.style.display === "none" || !dropdown.style.display) {
        dropdown.style.display = "block";
        getAllNotifications();
      } else {
        dropdown.style.display = "none";
      }
    });
    // Hide dropdown when clicking outside
    document.addEventListener("click", (e) => {
      const dropdown = document.getElementById("notificationsDropdown");
      if (dropdown && dropdown.style.display === "block") {
        if (!dropdown.contains(e.target) && e.target !== bell) {
          dropdown.style.display = "none";
        }
      }
    });
  }
});
