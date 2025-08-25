import { renderPosts } from "./utils/renderPost.js";
import { initializeImageModal, openImageModal } from "./utils/imageModal.js";
import { initializeThemeToggle } from "./utils/themeToggle.js";
import { showMessage } from "./utils/notifications.js";
import { initMobileSidebar } from "./utils/mobileSidebar.js";
import { authenticatedFetch } from "./utils/api.js";
import { openNotificationsModal } from "./utils/notifications.js";
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
    return (window.location.href = "/");
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
// Show modal on bell click (desktop)
document.addEventListener("DOMContentLoaded", () => {
  const bell = document.getElementById("notificationBell");
  // Auto-open notifications if requested via hash (e.g., #openNotifications)
  if (window.location.hash === "#openNotifications") {
    openNotificationsModal();
    // Clean up hash to avoid re-triggering on further navigations
    history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search
    );
  }
  if (bell) {
    bell.addEventListener("click", (e) => {
      e.stopPropagation();
      openNotificationsModal();
    });
  }
});
