import { renderPosts } from "./utils/renderPost.js";
import { initializeImageModal, openImageModal } from "./utils/imageModal.js";
import { initializeThemeToggle } from "./utils/themeToggle.js";

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

  const profileBtn = document.getElementById("profileBtn");
  const editProfileSection = document.getElementById("editProfileSection");

  const userInfoSection = document.getElementById("userInfoSection");
  const userUsername = document.getElementById("userUsername");
  const userEmail = document.getElementById("userEmail");
  const userProfilePic = document.getElementById("userProfilePic");

  const editProfileForm = document.getElementById("editProfileForm");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const profilePictureInput = document.getElementById("profilePicture");
  const userRole = document.getElementById("userRole");
  const userMemberSince = document.getElementById("userMemberSince");
  const userPostsCount = document.getElementById("userPostsCount");

  const currentUsername = localStorage.getItem("username");
  const token = localStorage.getItem("jwtToken");

  initializeImageModal();
  initializeThemeToggle();

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

  profileBtn.addEventListener("click", () => {
    const isVisible = !editProfileSection.classList.contains("hidden");
    editProfileSection.classList.toggle("hidden", isVisible);
    publishedSection.classList.toggle("hidden", !isVisible);
    draftsSection.classList.add("hidden");
  });

  editProfileForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
      email: emailInput.value,
    };

    const file = profilePictureInput.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result.split(",")[1];
        payload.profilePictureBase64 = base64;
        payload.profilePictureFileName = file.name;
        await updateUserProfile(payload);
      };
      reader.readAsDataURL(file);
    } else {
      await updateUserProfile(payload);
    }
  });

  fetchPublishedPosts();
  fetchDraftPosts();
  loadUserInfo();

  function switchTab(tab) {
    publishedSection.classList.toggle("hidden", tab !== "published");
    draftsSection.classList.toggle("hidden", tab !== "drafts");
    editProfileSection.classList.add("hidden");

    publishedBtn.classList.toggle("active", tab === "published");
    draftsBtn.classList.toggle("active", tab === "drafts");
  }

  async function fetchPublishedPosts() {
    try {
      const response = await fetch("https://localhost:7189/api/posts/user", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const posts = await response.json();
      renderPosts(posts, "publishedContainer", {
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
    try {
      const response = await fetch("https://localhost:7189/api/posts/drafts", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const posts = await response.json();
      renderPosts(posts, "draftsContainer", {
        showDelete: true,
        showModify: true,
        onDelete: (slug) => deletePost(slug, true),
        onModify: openModifyModal,
      });
    } catch (error) {
      console.error("Error fetching draft posts:", error);
    }
  }

  async function loadUserInfo() {
    try {
      const response = await fetch(
        `https://localhost:7189/api/users/${currentUsername}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch user info");

      const user = await response.json();

      userUsername.textContent = user.Username || currentUsername;
      userEmail.textContent = user.Email || "";
      emailInput.value = user.Email || "";
      userRole.textContent = user.Role || "Author";
      userMemberSince.textContent = user.CreatedAt
        ? new Date(user.CreatedAt).toLocaleDateString("en-GB", {
            year: "numeric",
            month: "long",
            day: "2-digit",
          })
        : "";
      userPostsCount.textContent = user.PostsCount || 0;
      if (user.ProfilePictureUrl) {
        // If the backend already returns a relative path like /Content/users/...
        userProfilePic.src = `https://localhost:7189${user.ProfilePictureUrl}`;
      } else {
        userProfilePic.src = "placeholders/profile.png";
      }
      userProfilePic.classList.remove("hidden");
    } catch (err) {
      console.error("Error loading user info:", err);
    }
  }

  async function updateUserProfile(payload) {
    try {
      const response = await fetch(
        `https://localhost:7189/api/users/${currentUsername}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (response.ok) {
        alert("Profile updated successfully!");
        loadUserInfo();
      } else {
        const error = await response.json();
        alert("Error: " + error.message);
      }
    } catch (err) {
      console.error("Error updating profile:", err);
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
