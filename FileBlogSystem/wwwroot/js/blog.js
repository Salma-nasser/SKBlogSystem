import { renderPosts } from "./utils/renderPost.js";
import { initializeImageModal, openImageModal } from "./utils/imageModal.js";
import { initializeThemeToggle } from "./utils/themeToggle.js";
import { showMessage } from "./utils/notifications.js";
let currentPage = 1;
const pageSize = 5;
let allPosts = [];
let activeFilter = null; // { type: "tag"|"category", value: "..." }

const clearFilterBtn = document.getElementById("clearFilterBtn");
initializeImageModal();
initializeThemeToggle();
window.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("jwtToken");
  if (!token) {
    return (window.location.href = "login");
  }

  // Show the “New Post” modal
  document.getElementById("newPostBtn")?.addEventListener("click", () => {
    document.getElementById("postModal")?.classList.remove("hidden");
  });

  // Close the modal
  document.getElementById("closeModal")?.addEventListener("click", () => {
    document.getElementById("postModal")?.classList.add("hidden");
  });

  // Handle Publish
  document
    .getElementById("createPostForm")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const token = localStorage.getItem("jwtToken");
      if (!token) return showMessage("Please log in first.", "warning");

      const form = e.target;
      const fd = new FormData(form);
      fd.set("IsPublished", "true");

      try {
        const res = await fetch("https://localhost:7189/api/posts/create", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        if (!res.ok) throw new Error(res.status);
        showMessage("Post published!", "success");
        reloadPosts();
        form.reset();
        document.getElementById("postModal")?.classList.add("hidden");
      } catch {
        showMessage("Publish failed", "error");
      }
    });

  // Handle Save Draft
  document
    .getElementById("saveDraftBtn")
    ?.addEventListener("click", async () => {
      const token = localStorage.getItem("jwtToken");
      if (!token) return showMessage("Please log in first.", "warning");

      const form = document.getElementById("createPostForm");
      const fd = new FormData(form);
      fd.set("IsPublished", "false");

      try {
        const res = await fetch("https://localhost:7189/api/posts/create", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        if (!res.ok) throw new Error(res.status);
        showMessage("Draft saved!", "success");
        reloadPosts();
        form.reset();
        document.getElementById("postModal")?.classList.add("hidden");
      } catch {
        showMessage("Save draft failed", "error");
      }
    });
  // ---------- VIEW PROFILE ----------
  document.getElementById("profileBtn")?.addEventListener("click", () => {
    window.location.href = "my-profile";
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
    window.location.href = "login";
  });

  // ---------- SEARCH & PAGINATION ----------
  document.getElementById("searchInput")?.addEventListener("input", () => {
    currentPage = 1;
    reloadPosts();
  });
  document.getElementById("prevPage")?.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      reloadPosts();
    }
  });
  document.getElementById("nextPage")?.addEventListener("click", () => {
    currentPage++;
    reloadPosts();
  });

  // ---------- CLEAR FILTER ----------
  clearFilterBtn?.addEventListener("click", () => {
    activeFilter = null;
    currentPage = 1;
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
      document.getElementById("clearFilterBtn").style.visibility = "visible";

      activeFilter = {
        type: el.dataset.type,
        value: el.dataset.value,
      };
      currentPage = 1;
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
