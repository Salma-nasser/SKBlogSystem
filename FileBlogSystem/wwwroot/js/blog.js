import { renderPosts } from "./utils/renderPost.js";
import { initializeImageModal, openImageModal } from "./utils/imageModal.js";
import { initializeThemeToggle } from "./utils/themeToggle.js";
import { showMessage } from "./utils/notifications.js";
import { initMobileSidebar } from "./utils/mobileSidebar.js";
import { authenticatedFetch } from "./utils/api.js";
let currentPage = 1;
const pageSize = 5;
let allPosts = [];
let activeFilter = null; // { type: "tag"|"category", value: "..." }

// Ensure a small status line to inform users about current search/filter
function ensureSearchStatusElement() {
  let el = document.getElementById("searchStatus");
  if (!el) {
    el = document.createElement("div");
    el.id = "searchStatus";
    el.style.margin = "8px 0 0 0";
    el.style.fontSize = "0.95rem";
    el.style.color = "#5a4636";
    el.style.textAlign = "center";
    const container =
      document.querySelector(".search-container") || document.body;
    container.parentNode.insertBefore(el, container.nextSibling);
  }
  return el;
}

function updateSearchStatus(searchQuery, filter) {
  const el = ensureSearchStatusElement();
  const parts = [];
  if (searchQuery) parts.push(`keyword: \"${searchQuery}\"`);
  if (filter?.type && filter?.value)
    parts.push(`${filter.type}: ${filter.value}`);
  if (parts.length) {
    el.textContent = `You are viewing posts for ${parts.join(" • ")}`;
    el.style.display = "block";
  } else {
    el.textContent = "";
    el.style.display = "none";
  }
}

// Highlight helpers
function removeHighlights(root) {
  root.querySelectorAll("mark.__hl").forEach((m) => {
    const parent = m.parentNode;
    if (!parent) return;
    parent.replaceChild(document.createTextNode(m.textContent || ""), m);
    parent.normalize();
  });
}

function highlightElement(root, terms) {
  if (!terms || terms.length === 0) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) {
    // Skip empty or whitespace-only text nodes
    if (!n.nodeValue || !n.nodeValue.trim()) continue;
    nodes.push(n);
  }
  const patterns = terms
    .filter((t) => t.length > 1)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (patterns.length === 0) return;
  const regex = new RegExp(`(${patterns.join("|")})`, "gi");
  for (const textNode of nodes) {
    const txt = textNode.nodeValue;
    if (!regex.test(txt)) continue;
    const frag = document.createDocumentFragment();
    let lastIdx = 0;
    txt.replace(regex, (match, _g1, offset) => {
      if (offset > lastIdx) {
        frag.appendChild(document.createTextNode(txt.slice(lastIdx, offset)));
      }
      const mark = document.createElement("mark");
      mark.className = "__hl"; // our marker so we can clear later
      mark.textContent = match;
      frag.appendChild(mark);
      lastIdx = offset + match.length;
      return match;
    });
    if (lastIdx < txt.length)
      frag.appendChild(document.createTextNode(txt.slice(lastIdx)));
    textNode.parentNode.replaceChild(frag, textNode);
  }
}

function applyHighlights(searchQuery) {
  const container = document.getElementById("postsContainer");
  if (!container) return;
  // Clear previous highlights
  removeHighlights(container);
  // Determine terms: prefer search query; fallback to active filter value
  let terms = [];
  if (searchQuery && searchQuery.trim()) {
    terms = searchQuery.split(/\s+/).filter(Boolean);
  } else if (activeFilter?.value) {
    terms = [activeFilter.value];
  }
  if (terms.length === 0) return;
  // Highlight across relevant regions in each card
  container.querySelectorAll(".post-card").forEach((card) => {
    const titleLink = card.querySelector("h3 a");
    const desc = card.querySelector(".post-description");
    const body = card.querySelector(".post-body");
    if (titleLink) highlightElement(titleLink, terms);
    if (desc) highlightElement(desc, terms);
    if (body) highlightElement(body, terms);
    // Also highlight tag/category chips
    card
      .querySelectorAll(".tag.clickable-tag, .category.clickable-tag")
      .forEach((chip) => highlightElement(chip, terms));
  });
}

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
initMobileSidebar();
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
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });
  document.getElementById("nextPage")?.addEventListener("click", () => {
    currentPage++;
    updateURL(currentPage);
    reloadPosts();
    window.scrollTo({ top: 0, behavior: "smooth" });
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
      // Wait a moment for backend to process, then refresh notifications and posts
      reloadPosts();
      setTimeout(getAllNotifications, 500);
    }
  });
});

// ---------- SHARED HELPERS ----------

async function reloadPosts() {
  // read query
  const searchQuery =
    document.getElementById("searchInput")?.value.trim() || "";
  const params = new URLSearchParams();
  if (searchQuery) params.set("q", searchQuery);
  if (activeFilter?.type && activeFilter?.value) {
    params.set("type", activeFilter.type);
    params.set("value", activeFilter.value);
  }

  try {
    let posts;
    if (searchQuery || activeFilter) {
      const res = await authenticatedFetch(`/api/search?${params.toString()}`);
      posts = await res.json();
    } else {
      const res = await authenticatedFetch("/api/posts");
      posts = await res.json();
      allPosts = posts;
    }

    // Only show published and not future scheduled
    const now = new Date();
    const visible = posts.filter((post) => {
      const sched = post.ScheduledDate ? new Date(post.ScheduledDate) : null;
      return post.IsPublished && (!sched || sched <= now);
    });

    renderPosts(paginate(visible, currentPage, pageSize), "postsContainer", {
      showDelete: false,
      showModify: false,
    });
    updatePagination(visible.length);
    // Update status line and apply highlights
    updateSearchStatus(searchQuery, activeFilter);
    applyHighlights(searchQuery);
  } catch (error) {
    if (error.message !== "Session expired") {
      console.error("Failed to reload posts:", error);
      showMessage("Could not load posts.", "error");
    }
  }
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
  const controls = document.getElementById("paginationControls");
  if (info) {
    info.textContent = `Page ${currentPage} of ${totalPages}`;
  }
  if (prevButton) {
    prevButton.disabled = currentPage === 1;
  }
  if (nextButton) {
    nextButton.disabled = currentPage === totalPages;
  }
  if (controls) {
    // Hide pagination controls when there's only one page
    controls.style.display = totalPages <= 1 ? "none" : "block";
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
