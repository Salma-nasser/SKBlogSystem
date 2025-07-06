import { renderPosts } from "./utils/renderPost.js";
import { initializeImageModal, openImageModal } from "./utils/imageModal.js";

window.addEventListener("DOMContentLoaded", () => {
  const publishedSection = document.getElementById("publishedSection");
  const draftsSection = document.getElementById("draftsSection");
  const publishedBtn = document.querySelector('button[data-tab="published"]');
  const draftsBtn = document.querySelector('button[data-tab="drafts"]');

  const backToBlogBtn = document.getElementById("backToBlogBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  const modifyPostModal = document.getElementById("modifyPostModal");
  const closeModifyModal = document.getElementById("closeModifyModal");
  const modifyPostForm = document.getElementById("modifyPostForm");

  initializeImageModal();

  // --- EVENT LISTENERS ---
  publishedBtn.addEventListener("click", () => switchTab("published"));
  draftsBtn.addEventListener("click", () => switchTab("drafts"));

  backToBlogBtn.addEventListener(
    "click",
    () => (window.location.href = "blog.html")
  );
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("jwtToken");
    window.location.href = "login.html";
  });

  closeModifyModal.addEventListener("click", () => {
    modifyPostModal.classList.add("hidden");
  });

  modifyPostForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await submitModification();
  });

  // --- INITIAL FETCH ---
  fetchPublishedPosts();
  fetchDraftPosts();

  // --- FUNCTIONS ---

  function switchTab(tab) {
    if (tab === "published") {
      publishedBtn.classList.add("active");
      draftsBtn.classList.remove("active");
      publishedSection.classList.remove("hidden");
      draftsSection.classList.add("hidden");
    } else {
      publishedBtn.classList.remove("active");
      draftsBtn.classList.add("active");
      publishedSection.classList.add("hidden");
      draftsSection.classList.remove("hidden");
    }
  }

  async function fetchPublishedPosts() {
    const token = localStorage.getItem("jwtToken");
    try {
      const response = await fetch("https://localhost:7189/api/posts/user", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const posts = await response.json();

      renderPosts(posts, "publishedContainer", {
        // 🔥 Pass ID as string
        showDelete: true,
        showModify: true,
        onDelete: (slug) => deletePost(slug, false),
        onModify: openModifyModal,
      });
    } catch (error) {
      console.error("Error fetching published posts:", error);
    }
  }

  async function fetchDraftPosts() {
    const token = localStorage.getItem("jwtToken");
    try {
      const response = await fetch("https://localhost:7189/api/posts/drafts", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const posts = await response.json();

      renderPosts(posts, "draftsContainer", {
        // 🔥 Pass ID as string
        showDelete: true,
        showModify: true,
        onDelete: (slug) => deletePost(slug, true),
        onModify: openModifyModal,
      });
    } catch (error) {
      console.error("Error fetching draft posts:", error);
    }
  }

  function openModifyModal(post) {
    document.getElementById("modifyTitle").value = post.title;
    document.getElementById("modifyDescription").value = post.description;
    document.getElementById("modifyBody").value = post.body;
    document.getElementById("modifyCustomUrl").value = post.customUrl || "";
    document.getElementById("modifyTags").value = post.tags?.join(", ") || "";
    document.getElementById("modifyCategories").value =
      post.categories?.join(", ") || "";
    document.getElementById("modifyScheduledDate").value = post.scheduledDate
      ? new Date(post.scheduledDate).toISOString().slice(0, 16)
      : "";
    document.getElementById("postSlug").value = post.slug;

    modifyPostModal.classList.remove("hidden");
  }

  async function submitModification() {
    const token = localStorage.getItem("jwtToken");
    const formData = new FormData(modifyPostForm);
    const slug = formData.get("postSlug");

    try {
      const response = await fetch(
        `https://localhost:7189/api/posts/modify/${slug}`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      );

      if (response.ok) {
        alert("Post updated successfully!");
        modifyPostModal.classList.add("hidden");
        fetchDraftPosts();
        fetchPublishedPosts();
      } else {
        const error = await response.json();
        alert("Error: " + error.message);
      }
    } catch (error) {
      console.error("Error updating post:", error);
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
});

// --- OUTSIDE FUNCTIONS ---

async function deletePost(slug, isDraft) {
  const token = localStorage.getItem("jwtToken");
  if (!confirm("Are you sure you want to delete this post?")) return;

  try {
    const response = await fetch(
      `https://localhost:7189/api/posts/delete/${slug}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (response.ok) {
      alert("Post deleted successfully!");
      if (isDraft) {
        document.querySelector("#draftsContainer").innerHTML = "";
        fetchDraftPosts();
      } else {
        document.querySelector("#publishedContainer").innerHTML = "";
        fetchPublishedPosts();
      }
    } else {
      const error = await response.json();
      alert("Error: " + error.message);
    }
  } catch (error) {
    console.error("Error deleting post:", error);
  }
}
