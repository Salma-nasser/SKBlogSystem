import { renderPosts } from "./utils/renderPost.js";
import { initializeImageModal, openImageModal } from "./utils/imageModal.js";
import { initializeThemeToggle } from "./utils/themeToggle.js";
import { showMessage } from "./utils/notifications.js";
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
});

// ---------- SHARED HELPERS ----------

function getAuthHeaders() {
  const token = localStorage.getItem("jwtToken");
  return { Authorization: `Bearer ${token}` };
}

async function reloadPosts() {
  let posts;

  if (!activeFilter) {
    const res = await fetch("https://localhost:7189/api/posts", {
      headers: getAuthHeaders(),
    });
    posts = await res.json();
    allPosts = posts;
  } else {
    const urlBase = `https://localhost:7189/api/posts/${
      activeFilter.type
    }/${encodeURIComponent(activeFilter.value)}`;
    const res = await fetch(urlBase, { headers: getAuthHeaders() });
    posts = await res.json();
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
