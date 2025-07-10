import { renderPosts } from "./utils/renderPost.js";
import { initializeImageModal, openImageModal } from "./utils/imageModal.js";
import { initializeThemeToggle } from "./utils/themeToggle.js";

window.addEventListener("DOMContentLoaded", () => {
  // Tab sections
  const publishedSection = document.getElementById("publishedSection");
  const draftsSection = document.getElementById("draftsSection");
  const publishedBtn = document.querySelector('button[data-tab="published"]');
  const draftsBtn = document.querySelector('button[data-tab="drafts"]');

  // Navigation buttons
  const backToBlogBtn = document.getElementById("backToBlogBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  // Post modification modal
  const modifyPostModal = document.getElementById("modifyPostModal");
  const closeModifyModal = document.getElementById("closeModifyModal");
  const modifyPostForm = document.getElementById("modifyPostForm");

  // User info elements
  const userUsername = document.getElementById("userUsername");
  const userEmail = document.getElementById("userEmail");
  const userProfilePic = document.getElementById("userProfilePic");
  const userRole = document.getElementById("userRole");
  const userMemberSince = document.getElementById("userMemberSince");
  const userPostsCount = document.getElementById("userPostsCount");

  // Edit sections
  const changeEmailSection = document.getElementById("changeEmailSection");
  const changePasswordSection = document.getElementById(
    "changePasswordSection"
  );
  const changePictureSection = document.getElementById("changePictureSection");

  // Edit buttons
  const changeEmailBtn = document.getElementById("changeEmailBtn");
  const changePasswordBtn = document.getElementById("changePasswordBtn");
  const changePictureBtn = document.getElementById("changePictureBtn");

  // Edit forms
  const changeEmailForm = document.getElementById("changeEmailForm");
  const changePasswordForm = document.getElementById("changePasswordForm");
  const changePictureForm = document.getElementById("changePictureForm");

  // Form elements
  const currentEmailInput = document.getElementById("currentEmail");
  const newEmailInput = document.getElementById("newEmail");
  const emailPasswordInput = document.getElementById("emailPassword");
  const currentPasswordInput = document.getElementById("currentPassword");
  const newPasswordInput = document.getElementById("newPassword");
  const confirmPasswordInput = document.getElementById("confirmPassword");
  const newProfilePictureInput = document.getElementById("newProfilePicture");
  const picturePreview = document.getElementById("picturePreview");

  const currentUsername = localStorage.getItem("username");
  const token = localStorage.getItem("jwtToken");

  initializeImageModal();
  initializeThemeToggle();

  // Event listeners for tab switching
  publishedBtn.addEventListener("click", () => switchTab("published"));
  draftsBtn.addEventListener("click", () => switchTab("drafts"));

  // Navigation event listeners
  backToBlogBtn.addEventListener(
    "click",
    () => (window.location.href = "blog")
  );
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("jwtToken");
    window.location.href = "login";
  });

  // Modal close event
  closeModifyModal.addEventListener("click", () => {
    modifyPostModal.classList.add("hidden");
  });

  // Post modification form submission
  modifyPostForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await submitModification();
  });

  // Edit section toggle buttons
  changeEmailBtn.addEventListener("click", () => toggleEditSection("email"));
  changePasswordBtn.addEventListener("click", () =>
    toggleEditSection("password")
  );
  changePictureBtn.addEventListener("click", () =>
    toggleEditSection("picture")
  );

  // Cancel buttons
  document
    .getElementById("cancelEmailChange")
    .addEventListener("click", () => toggleEditSection("email", false));
  document
    .getElementById("cancelPasswordChange")
    .addEventListener("click", () => toggleEditSection("password", false));
  document
    .getElementById("cancelPictureChange")
    .addEventListener("click", () => toggleEditSection("picture", false));

  // Form submissions
  changeEmailForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await updateEmail();
  });

  changePasswordForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await updatePassword();
  });

  changePictureForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await updateProfilePicture();
  });

  // Profile picture preview
  newProfilePictureInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        picturePreview.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  });

  // Initial data loading
  fetchPublishedPosts();
  fetchDraftPosts();
  loadUserInfo();

  function switchTab(tab) {
    publishedSection.classList.toggle("hidden", tab !== "published");
    draftsSection.classList.toggle("hidden", tab !== "drafts");

    // Hide all edit sections when switching tabs
    changeEmailSection.classList.add("hidden");
    changePasswordSection.classList.add("hidden");
    changePictureSection.classList.add("hidden");

    publishedBtn.classList.toggle("active", tab === "published");
    draftsBtn.classList.toggle("active", tab === "drafts");
  }

  function toggleEditSection(section, show = true) {
    // Hide all edit sections first
    changeEmailSection.classList.add("hidden");
    changePasswordSection.classList.add("hidden");
    changePictureSection.classList.add("hidden");

    // Hide posts sections when showing an edit section
    publishedSection.classList.toggle("hidden", show);
    draftsSection.classList.add("hidden");

    // Show the requested section
    switch (section) {
      case "email":
        changeEmailSection.classList.toggle("hidden", !show);
        if (show) currentEmailInput.value = userEmail.textContent;
        break;
      case "password":
        changePasswordSection.classList.toggle("hidden", !show);
        break;
      case "picture":
        changePictureSection.classList.toggle("hidden", !show);
        picturePreview.src = userProfilePic.src;
        break;
    }
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
        userProfilePic.src = `https://localhost:7189${user.ProfilePictureUrl}`;
        userProfilePic.classList.remove("hidden");
      } else {
        userProfilePic.src = "placeholders/profile.png";
        userProfilePic.classList.remove("hidden");
      }
    } catch (err) {
      console.error("Error loading user info:", err);
    }
  }

  async function updateEmail() {
    const newEmail = newEmailInput.value.trim();
    const currentPassword = emailPasswordInput.value;

    clearErrors("newEmail", "emailPassword");

    if (!newEmail) {
      showError("newEmail", "New email is required.");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (newEmail && !emailRegex.test(newEmail)) {
      showError("newEmail", "Please enter a valid email.");
    }

    if (!currentPassword) {
      showError("emailPassword", "Password is required.");
    }

    if (!newEmail || !currentPassword || !emailRegex.test(newEmail)) return;

    try {
      const response = await fetch(
        `https://localhost:7189/api/users/${currentUsername}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            Email: newEmail,
            ConfirmPassword: currentPassword,
          }),
        }
      );

      if (response.ok) {
        toggleEditSection("email", false);
        loadUserInfo();
      } else {
        const error = await response.json();
        showError("newEmail", error.message || "Failed to update email.");
      }
    } catch (err) {
      showError("newEmail", "Network error. Please try again.");
    }
  }

  async function updatePassword() {
    const current = currentPasswordInput.value;
    const newPass = newPasswordInput.value;
    const confirm = confirmPasswordInput.value;

    clearErrors("currentPassword", "newPassword", "confirmPassword");

    if (!current) showError("currentPassword", "Current password is required.");
    if (!newPass) showError("newPassword", "New password is required.");
    if (newPass.length > 0 && newPass.length < 6)
      showError("newPassword", "Must be at least 6 characters.");
    if (!confirm) showError("confirmPassword", "Please confirm password.");
    if (newPass && confirm && newPass !== confirm)
      showError("confirmPassword", "Passwords do not match.");

    if (
      !current ||
      !newPass ||
      !confirm ||
      newPass.length < 6 ||
      newPass !== confirm
    )
      return;

    try {
      const response = await fetch(
        `https://localhost:7189/api/users/${currentUsername}/password`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            CurrentPassword: current,
            NewPassword: newPass,
          }),
        }
      );

      if (response.ok) {
        toggleEditSection("password", false);
        currentPasswordInput.value = "";
        newPasswordInput.value = "";
        confirmPasswordInput.value = "";
      } else {
        const error = await response.json();
        showError("currentPassword", error.message || "Update failed.");
      }
    } catch (err) {
      showError("currentPassword", "Network error. Please try again.");
    }
  }

  async function updateProfilePicture() {
    const file = newProfilePictureInput.files[0];
    const errorEl = document.getElementById("pictureError");
    errorEl.textContent = "";

    if (!file) {
      errorEl.textContent = "Please select a file.";
      return;
    }

    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      errorEl.textContent = "Invalid file type.";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      errorEl.textContent = "File must be smaller than 2MB.";
      return;
    }

    try {
      // Convert the file to base64
      const base64Image = await convertFileToBase64(file);

      // Send the update request with base64 image
      const response = await fetch(
        `https://localhost:7189/api/users/${currentUsername}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ProfilePictureBase64: base64Image.split(",")[1], // Remove the data:image/xxx;base64, prefix
            ProfilePictureFileName: file.name,
          }),
        }
      );

      if (response.ok) {
        toggleEditSection("picture", false);
        loadUserInfo();
      } else {
        const error = await response.json();
        errorEl.textContent = error.message || "Failed to update.";
      }
    } catch (err) {
      errorEl.textContent = "Network error. Please try again.";
      console.error(err);
    }
  }

  // Helper function to convert File to base64
  function convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
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
});

// Image click handler for modal (moved outside DOMContentLoaded)
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

function showError(inputId, message) {
  const errorElement = document.getElementById(inputId + "Error");
  if (errorElement) {
    errorElement.textContent = message;
  } else {
    console.warn(`Error element not found: ${inputId}Error`);
  }
}

function clearErrors(...inputIds) {
  inputIds.forEach((id) => {
    const errorElement = document.getElementById(id + "Error");
    if (errorElement) {
      errorElement.textContent = "";
    } else {
      console.warn(`Error element not found: ${id}Error`);
    }
  });
}
