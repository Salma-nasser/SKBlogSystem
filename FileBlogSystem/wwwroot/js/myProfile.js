import { renderPosts, safeBase64Decode } from "./utils/renderPost.js";
import { initializeImageModal, openImageModal } from "./utils/imageModal.js";
import { initializeThemeToggle } from "./utils/themeToggle.js";
import { showMessage, showConfirmation } from "./utils/notifications.js";
import { authenticatedFetch, HttpError } from "./utils/api.js";

let imagesToKeep = [];

window.addEventListener("DOMContentLoaded", () => {
  // Get username from query parameter or URL path
  const urlParams = new URLSearchParams(window.location.search);
  let profileUsername = urlParams.get("username");
  const logoutBtn1 = document.querySelector(
    'a[href="/logout"], .header-buttons .btn[href="/logout"]'
  );
  if (logoutBtn1) {
    logoutBtn1.addEventListener("click", function (e) {
      localStorage.removeItem("jwtToken");
      localStorage.removeItem("username");
    });
  }
  // If no query param, try to extract from path: /profile/{username}
  if (!profileUsername) {
    const pathMatch = window.location.pathname.match(/^\/profile\/(.+)$/);
    if (pathMatch && pathMatch[1] && pathMatch[1] !== "profile") {
      profileUsername = pathMatch[1];
    }
  }

  // Get current user's username
  const currentUsername = localStorage.getItem("username");
  const token = localStorage.getItem("jwtToken");

  // If path is /profile/my-profile, always use localStorage username
  let isOwnProfile = false;
  let targetUsername = profileUsername;
  if (window.location.pathname === "/profile/my-profile") {
    isOwnProfile = true;
    targetUsername = currentUsername;
  } else {
    isOwnProfile = profileUsername === currentUsername;
    targetUsername = isOwnProfile ? currentUsername : profileUsername;
  }

  const ProfileTitle = document.getElementById("ProfileTitle");
  // Update page title and header
  document.title = isOwnProfile ? "My Profile" : `${targetUsername}'s Profile`;
  if (ProfileTitle) {
    ProfileTitle.textContent = isOwnProfile
      ? "Your Profile"
      : `${targetUsername}'s Profile`;
  }
  // Update URL to reflect profile being viewed
  const currentPath = window.location.pathname;
  const currentSearch = window.location.search;
  // Only rewrite to /profile/my-profile if the user is truly viewing their own profile
  if (
    isOwnProfile &&
    (currentPath === `/profile/${currentUsername}` ||
      currentSearch === `?username=${currentUsername}`)
  ) {
    if (currentPath !== "/profile/my-profile") {
      window.history.replaceState({}, document.title, "/profile/my-profile");
    }
  }

  // Initialize components
  initializeImageModal();
  initializeThemeToggle();

  // Make functions globally accessible for onclick handlers
  window.openModifyPage = openModifyPage;
  window.deletePost = deletePost;

  // DOM elements
  const publishedSection = document.getElementById("publishedSection");
  const draftsSection = document.getElementById("draftsSection");
  const publishedBtn = document.querySelector('button[data-tab="published"]');
  const draftsBtn = document.querySelector('button[data-tab="drafts"]');

  // Navigation buttons
  const backToBlogBtn = document.getElementById("backToBlogBtn");
  const logoutBtn = document.getElementById("logoutBtn");

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

  // Show/hide sections based on profile ownership
  setupProfileView(isOwnProfile);

  function setupProfileView(isOwnProfile) {
    // Show/hide edit buttons based on profile ownership
    const editButtons = document.querySelectorAll(".edit-btn");
    editButtons.forEach((btn) => {
      btn.style.display = isOwnProfile ? "inline-block" : "none";
    });

    // Show/hide drafts tab based on profile ownership
    if (draftsBtn) {
      draftsBtn.style.display = isOwnProfile ? "inline-block" : "none";
    }

    // Show/hide email based on profile ownership
    if (userEmail) {
      const emailParent = userEmail.closest("p");
      if (emailParent) {
        emailParent.style.display = isOwnProfile ? "contents" : "none";
      }
    }

    // Update published posts tab text
    if (publishedBtn) {
      publishedBtn.textContent = isOwnProfile ? "Published Posts" : "Posts";
    }

    // Hide edit sections if not own profile
    if (!isOwnProfile) {
      const editSections = document.querySelectorAll(".edit-section");
      editSections.forEach((section) => {
        section.style.display = "none";
      });
    }
  }

  // Event listeners for tab switching
  publishedBtn?.addEventListener("click", () => switchTab("published"));
  if (isOwnProfile) {
    draftsBtn?.addEventListener("click", () => switchTab("drafts"));
  }

  // Navigation event listeners
  backToBlogBtn?.addEventListener(
    "click",
    () => (window.location.href = "/blog")
  );
  logoutBtn?.addEventListener("click", () => {
    localStorage.removeItem("jwtToken");
    showMessage("Logged out successfully", "info");
    setTimeout(() => {
      window.location.href = "/login";
    }, 1000);
  });

  // Only add edit functionality if it's the user's own profile
  if (isOwnProfile) {
    setupEditFunctionality();
  }

  // Initial data loading
  console.log(
    `Loading profile for: ${targetUsername}, isOwnProfile: ${isOwnProfile}`
  );
  fetchPublishedPosts(targetUsername);
  if (isOwnProfile) {
    fetchDraftPosts();
  }
  loadUserInfo(targetUsername);
  function deleteAccount() {
    try {
      authenticatedFetch(
        `/api/users/delete/${currentUsername}`,
        {
          method: "PUT",
        }
      );
    } catch (error) {
      if (error.message !== "Session expired") {
        console.error("Error deleting account:", error);
        showMessage("Failed to delete account.", "error");
      }
    }
  }
  function setupEditFunctionality() {
    // Edit section toggle buttons
    changeEmailBtn?.addEventListener("click", () => toggleEditSection("email"));
    changePasswordBtn?.addEventListener("click", () =>
      toggleEditSection("password")
    );
    changePictureBtn?.addEventListener("click", () =>
      toggleEditSection("picture")
    );
    deleteAccountBtn?.addEventListener("click", () => {
      showConfirmation(
        "Delete Account",
        "Are you sure you want to delete your account?",
        () => {
          deleteAccount();
        }
      );
    });
    // Cancel buttons
    document
      .getElementById("cancelEmailChange")
      ?.addEventListener("click", () => toggleEditSection("email", false));
    document
      .getElementById("cancelPasswordChange")
      ?.addEventListener("click", () => toggleEditSection("password", false));
    document
      .getElementById("cancelPictureChange")
      ?.addEventListener("click", () => toggleEditSection("picture", false));

    // Form submissions
    changeEmailForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await updateEmail();
    });

    changePasswordForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await updatePassword();
    });

    changePictureForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await updateProfilePicture();
    });

    // Profile picture preview
    newProfilePictureInput?.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          picturePreview.src = event.target.result;
        };
        reader.readAsDataURL(file);
      }
    });

    // Add preview functionality for modify modal images
    const modifyImagesInput = document.getElementById("modifyImages");
    modifyImagesInput?.addEventListener("change", (e) => {
      previewNewImages(e.target.files);
    });
  }

  function previewNewImages(files) {
    const container = document.getElementById("currentImagesContainer");

    if (!container) {
      console.warn("currentImagesContainer not found in HTML");
      return;
    }

    // Remove any existing preview images
    container
      .querySelectorAll(".new-image-preview")
      .forEach((el) => el.remove());

    if (files && files.length > 0) {
      Array.from(files).forEach((file, index) => {
        if (file.type.startsWith("image/")) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const previewWrapper = document.createElement("div");
            previewWrapper.className =
              "current-image-wrapper new-image-preview";

            const img = document.createElement("img");
            img.src = e.target.result;
            img.alt = `New Image ${index + 1}`;
            img.className = "current-image";

            const newLabel = document.createElement("div");
            newLabel.className = "new-image-label";
            newLabel.textContent = "NEW";

            previewWrapper.appendChild(img);
            previewWrapper.appendChild(newLabel);
            container.appendChild(previewWrapper);
          };
          reader.readAsDataURL(file);
        }
      });
    }
  }

  function switchTab(tab = "published") {
    publishedSection?.classList.toggle("hidden", tab !== "published");

    if (isOwnProfile) {
      draftsSection?.classList.toggle("hidden", tab !== "drafts");
    }

    // Hide all edit sections when switching tabs
    changeEmailSection?.classList.add("hidden");
    changePasswordSection?.classList.add("hidden");
    changePictureSection?.classList.add("hidden");

    publishedBtn?.classList.toggle("active", tab === "published");
    if (isOwnProfile) {
      draftsBtn?.classList.toggle("active", tab === "drafts");
    }
  }

  function toggleEditSection(section, show = true) {
    if (!isOwnProfile) return;

    // Hide all edit sections first
    changeEmailSection?.classList.add("hidden");
    changePasswordSection?.classList.add("hidden");
    changePictureSection?.classList.add("hidden");

    // Hide posts sections when showing an edit section
    publishedSection?.classList.toggle("hidden", show);
    draftsSection?.classList.add("hidden");

    // Show the requested section
    switch (section) {
      case "email":
        changeEmailSection?.classList.toggle("hidden", !show);
        if (show && currentEmailInput)
          currentEmailInput.value = userEmail.textContent;
        break;
      case "password":
        changePasswordSection?.classList.toggle("hidden", !show);
        break;
      case "picture":
        changePictureSection?.classList.toggle("hidden", !show);
        if (show && picturePreview) picturePreview.src = userProfilePic.src;
        break;
    }
  }

  async function fetchPublishedPosts(username = currentUsername) {
    try {
      const endpoint = `/api/posts/user/${username}`;
      console.log(`Fetching posts from: ${endpoint}`);

      const response = await authenticatedFetch(endpoint);

      console.log(`Response status: ${response.status}`);

      const posts = await response.json();
      console.log(`Fetched ${posts.length} posts for user: ${username}`, posts);

      // Store posts for modify functionality
      allPublishedPosts = posts;

      renderPosts(posts, "publishedContainer", {
        showDelete: isOwnProfile,
        showModify: isOwnProfile,
        showActions: true,
      });
    } catch (error) {
      if (error.message !== "Session expired") {
        console.error("Error fetching published posts:", error);
        document.getElementById("publishedContainer").innerHTML =
          '<p class="error-message">Failed to load posts</p>';
        showMessage("Failed to load published posts", "error");
      }
    }
  }

  async function fetchDraftPosts() {
    try {
      const response = await fetch("/api/posts/drafts", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const posts = await response.json();

      // Store posts for modify functionality
      allDraftPosts = posts;

      renderPosts(posts, "draftsContainer", {
        showDelete: true,
        showModify: true,
        showActions: true,
      });
    } catch (error) {
      if (error.message !== "Session expired") {
        console.error("Error fetching draft posts:", error);
        showMessage("Failed to load draft posts", "error");
      }
    }
  }

  async function loadUserInfo(username = currentUsername) {
    try {
      const response = await fetch(
        `/api/users/${username}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const user = await response.json();

      userUsername.textContent = user.Username || username;
      userRole.textContent = user.Role || "Author";
      userMemberSince.textContent = user.CreatedAt
        ? new Date(user.CreatedAt).toLocaleDateString("en-GB", {
            year: "numeric",
            month: "long",
            day: "2-digit",
          })
        : "";
      userPostsCount.textContent = user.PostsCount || 0;

      // Show email only for own profile
      const emailParent = userEmail.closest("p");
      if (isOwnProfile) {
        userEmail.textContent = user.Email || "";
        if (emailParent) emailParent.style.display = "block";
        userEmail.style.display = "inline";
      } else {
        if (emailParent) emailParent.style.display = "none";
        userEmail.style.display = "none";
      }

      // Handle profile picture with error handling
      if (user.ProfilePictureUrl && user.ProfilePictureUrl.trim()) {
        userProfilePic.src = `${user.ProfilePictureUrl}`;
        userProfilePic.onerror = function () {
          this.src = "/placeholders/profile.png";
          this.onerror = null;
        };
        userProfilePic.classList.remove("hidden");
      } else {
        userProfilePic.src = "/placeholders/profile.png";
        userProfilePic.classList.remove("hidden");
      }
    } catch (err) {
      if (err.message !== "Session expired") {
        console.error("Error loading user info:", err);
        userUsername.textContent = username;
        userRole.textContent = "User";
        userMemberSince.textContent = "";
        userPostsCount.textContent = "0";
        userProfilePic.src = "/placeholders/profile.png";
        showMessage("Failed to load user information", "error");
      }
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

  // Add event delegation for dynamically created buttons
  document.addEventListener("click", (e) => {
    // Handle modify button clicks
    if (e.target.classList.contains("modifyBtn")) {
      e.preventDefault();
      const postCard = e.target.closest(".post-card");
      const slug = postCard?.dataset.slug;

      if (slug) {
        // Find the post data
        const post = findPostBySlug(slug);
        if (post) {
          openModifyPage(post);
        } else {
          showMessage("Post data not found", "error");
        }
      }
    }

    // Handle delete button clicks
    if (e.target.classList.contains("deleteBtn")) {
      e.preventDefault();
      const postCard = e.target.closest(".post-card");
      const slug = postCard?.dataset.slug;

      if (slug) {
        deletePost(slug);
      }
    }

    // Handle image clicks for modal
    if (e.target.classList.contains("post-image")) {
      e.preventDefault();
      const postCard = e.target.closest(".post-card");
      const images = Array.from(postCard.querySelectorAll(".post-image")).map(
        (img) => img.src
      );
      const clickedIndex = images.indexOf(e.target.src);
      openImageModal(images, clickedIndex);
    }
  });

  // Store posts data for modify functionality
  let allPublishedPosts = [];
  let allDraftPosts = [];

  function findPostBySlug(slug) {
    return [...allPublishedPosts, ...allDraftPosts].find(
      (post) => post.Slug === slug
    );
  }

  // Navigation event listeners
  backToBlogBtn?.addEventListener(
    "click",
    () => (window.location.href = "/blog")
  );
  logoutBtn?.addEventListener("click", () => {
    localStorage.removeItem("jwtToken");
    showMessage("Logged out successfully", "info");
    setTimeout(() => {
      window.location.href = "/login";
    }, 1000);
  });

  // Only add edit functionality if it's the user's own profile
  if (isOwnProfile) {
    setupEditFunctionality();
  }

  // Initial data loading
  console.log(
    `Loading profile for: ${targetUsername}, isOwnProfile: ${isOwnProfile}`
  );
  fetchPublishedPosts(targetUsername);
  if (isOwnProfile) {
    fetchDraftPosts();
  }
  loadUserInfo(targetUsername);

  function setupEditFunctionality() {
    // Edit section toggle buttons
    changeEmailBtn?.addEventListener("click", () => toggleEditSection("email"));
    changePasswordBtn?.addEventListener("click", () =>
      toggleEditSection("password")
    );
    changePictureBtn?.addEventListener("click", () =>
      toggleEditSection("picture")
    );

    // Cancel buttons
    document
      .getElementById("cancelEmailChange")
      ?.addEventListener("click", () => toggleEditSection("email", false));
    document
      .getElementById("cancelPasswordChange")
      ?.addEventListener("click", () => toggleEditSection("password", false));
    document
      .getElementById("cancelPictureChange")
      ?.addEventListener("click", () => toggleEditSection("picture", false));

    // Form submissions
    changeEmailForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await updateEmail();
    });

    changePasswordForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await updatePassword();
    });

    changePictureForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await updateProfilePicture();
    });

    // Profile picture preview
    newProfilePictureInput?.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          picturePreview.src = event.target.result;
        };
        reader.readAsDataURL(file);
      }
    });

    // Add preview functionality for modify modal images
    const modifyImagesInput = document.getElementById("modifyImages");
    modifyImagesInput?.addEventListener("change", (e) => {
      previewNewImages(e.target.files);
    });
  }

  function previewNewImages(files) {
    const container = document.getElementById("currentImagesContainer");

    if (!container) {
      console.warn("currentImagesContainer not found in HTML");
      return;
    }

    // Remove any existing preview images
    container
      .querySelectorAll(".new-image-preview")
      .forEach((el) => el.remove());

    if (files && files.length > 0) {
      Array.from(files).forEach((file, index) => {
        if (file.type.startsWith("image/")) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const previewWrapper = document.createElement("div");
            previewWrapper.className =
              "current-image-wrapper new-image-preview";

            const img = document.createElement("img");
            img.src = e.target.result;
            img.alt = `New Image ${index + 1}`;
            img.className = "current-image";

            const newLabel = document.createElement("div");
            newLabel.className = "new-image-label";
            newLabel.textContent = "NEW";

            previewWrapper.appendChild(img);
            previewWrapper.appendChild(newLabel);
            container.appendChild(previewWrapper);
          };
          reader.readAsDataURL(file);
        }
      });
    }
  }

  function switchTab(tab = "published") {
    publishedSection?.classList.toggle("hidden", tab !== "published");

    if (isOwnProfile) {
      draftsSection?.classList.toggle("hidden", tab !== "drafts");
    }

    // Hide all edit sections when switching tabs
    changeEmailSection?.classList.add("hidden");
    changePasswordSection?.classList.add("hidden");
    changePictureSection?.classList.add("hidden");

    publishedBtn?.classList.toggle("active", tab === "published");
    if (isOwnProfile) {
      draftsBtn?.classList.toggle("active", tab === "drafts");
    }
  }

  function toggleEditSection(section, show = true) {
    if (!isOwnProfile) return;

    // Hide all edit sections first
    changeEmailSection?.classList.add("hidden");
    changePasswordSection?.classList.add("hidden");
    changePictureSection?.classList.add("hidden");

    // Hide posts sections when showing an edit section
    publishedSection?.classList.toggle("hidden", show);
    draftsSection?.classList.add("hidden");

    // Show the requested section
    switch (section) {
      case "email":
        changeEmailSection?.classList.toggle("hidden", !show);
        if (show && currentEmailInput)
          currentEmailInput.value = userEmail.textContent;
        break;
      case "password":
        changePasswordSection?.classList.toggle("hidden", !show);
        break;
      case "picture":
        changePictureSection?.classList.toggle("hidden", !show);
        if (show && picturePreview) picturePreview.src = userProfilePic.src;
        break;
    }
  }

  async function updateEmail() {
    const newEmail = newEmailInput.value.trim();
    const currentPassword = emailPasswordInput.value;

    clearErrors("newEmail", "emailPassword");

    if (!newEmail) {
      showError("newEmail", "New email is required.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (newEmail && !emailRegex.test(newEmail)) {
      showError("newEmail", "Please enter a valid email.");
      return;
    }

    if (!currentPassword) {
      showError("emailPassword", "Password is required.");
      return;
    }

    try {
      const response = await fetch(
        `/api/users/${currentUsername}`,
        {
          method: "PUT",
          body: JSON.stringify({
            Email: newEmail,
            ConfirmPassword: currentPassword,
          }),
        }
      );

      showMessage("Email updated successfully!", "success");
      toggleEditSection("email", false);
      loadUserInfo(targetUsername);
    } catch (err) {
      if (err instanceof HttpError && err.message !== "Session expired") {
        const error = await err.response.json();
        showError("newEmail", error.message || "Failed to update email.");
      } else if (err.message !== "Session expired") {
        showError("newEmail", "Network error. Please try again.");
        showMessage("Network error occurred while updating email", "error");
      }
    }
  }

  async function updatePassword() {
    const current = currentPasswordInput.value;
    const newPass = newPasswordInput.value;
    const confirm = confirmPasswordInput.value;

    clearErrors("currentPassword", "newPassword", "confirmPassword");

    if (!current) {
      showError("currentPassword", "Current password is required.");
      return;
    }
    if (!newPass) {
      showError("newPassword", "New password is required.");
      return;
    }
    if (newPass.length > 0 && newPass.length < 6) {
      showError("newPassword", "Must be at least 6 characters.");
      return;
    }
    if (!confirm) {
      showError("confirmPassword", "Please confirm password.");
      return;
    }
    if (newPass && confirm && newPass !== confirm) {
      showError("confirmPassword", "Passwords do not match.");
      return;
    }

    try {
      const response = await fetch(
        `/api/users/${currentUsername}/password`,
        {
          method: "PUT",
          body: JSON.stringify({
            CurrentPassword: current,
            NewPassword: newPass,
          }),
        }
      );

      showMessage("Password updated successfully!", "success");
      toggleEditSection("password", false);
      currentPasswordInput.value = "";
      newPasswordInput.value = "";
      confirmPasswordInput.value = "";
    } catch (err) {
      if (err instanceof HttpError && err.message !== "Session expired") {
        const error = await err.response.json();
        showError("currentPassword", error.message || "Update failed.");
      } else if (err.message !== "Session expired") {
        showError("currentPassword", "Network error. Please try again.");
        showMessage("Network error occurred while updating password", "error");
      }
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
      const base64Image = await convertFileToBase64(file);

      const response = await fetch(
        `/api/users/${currentUsername}`,
        {
          method: "PUT",
          body: JSON.stringify({
            ProfilePictureBase64: base64Image.split(",")[1],
            ProfilePictureFileName: file.name,
          }),
        }
      );

      showMessage("Profile picture updated successfully!", "success");
      toggleEditSection("picture", false);
      loadUserInfo(targetUsername);
    } catch (err) {
      if (err instanceof HttpError && err.message !== "Session expired") {
        const error = await err.response.json();
        errorEl.textContent = error.message || "Failed to update.";
      } else if (err.message !== "Session expired") {
        errorEl.textContent = "Network error. Please try again.";
        showMessage(
          "Network error occurred while updating profile picture",
          "error"
        );
        console.error(err);
      }
    }
  }

  async function deletePost(slug) {
    // Create custom confirmation dialog
    const confirmDialog = document.createElement("div");
    confirmDialog.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10001;
    `;

    confirmDialog.innerHTML = `
      <div style="
        background: var(--post-bg, white);
        padding: 30px;
        border-radius: 12px;
        text-align: center;
        max-width: 400px;
        color: var(--text-color, #333);
      ">
        <h3 style="margin: 0 0 15px 0;">Delete Post</h3>
        <p style="margin: 0 0 20px 0;">Are you sure you want to delete this post? This action cannot be undone.</p>
        <div style="display: flex; gap: 10px; justify-content: center;">
          <button id="confirmDelete" style="
            background: #dc3545;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
          ">Delete</button>
          <button id="cancelDelete" style="
            background: var(--button-bg, #8c6e63);
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
          ">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(confirmDialog);

    document.getElementById("confirmDelete").onclick = async () => {
      try {
        const response = await fetch(
          `/api/posts/${slug}`,
          {
            method: "DELETE",
          }
        );

        showMessage("Post deleted successfully", "success");
        // Refresh both lists
        fetchPublishedPosts(targetUsername);
        if (isOwnProfile) {
          fetchDraftPosts();
        }
      } catch (error) {
        if (error.message !== "Session expired") {
          console.error("Error deleting post:", error);
          showMessage("Error occurred while deleting post", "error");
        }
      }
      confirmDialog.remove();
    };

    document.getElementById("cancelDelete").onclick = () => {
      confirmDialog.remove();
    };
  }

  // Initial data fetch
  fetchPublishedPosts(targetUsername);
  if (isOwnProfile) {
    fetchDraftPosts();
  }
  loadUserInfo(targetUsername);
});

function displayCurrentImages(post) {
  const container = document.getElementById("currentImagesContainer");

  if (!container) {
    console.warn("currentImagesContainer not found in HTML");
    return;
  }

  container.innerHTML = "";

  if (post.Images && post.Images.length > 0) {
    const dateOnly = new Date(post.PublishedDate || post.CreatedDate)
      .toISOString()
      .split("T")[0];

    post.Images.forEach((imagePath, index) => {
      const imageWrapper = document.createElement("div");
      imageWrapper.className = "current-image-wrapper";

      const img = document.createElement("img");
      img.src = `/Content/posts/${dateOnly}-${post.Slug}${imagePath}`;
      img.alt = `Post Image ${index + 1}`;
      img.className = "current-image";

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "remove-image-btn";
      removeBtn.innerHTML = "✖";
      removeBtn.title = "Remove this image";
      removeBtn.addEventListener("click", () =>
        removeCurrentImage(imageWrapper, imagePath, post.Slug)
      );

      imageWrapper.appendChild(img);
      imageWrapper.appendChild(removeBtn);
      container.appendChild(imageWrapper);
    });
  } else {
    container.innerHTML = '<p class="no-images">No images in this post</p>';
  }
}

function removeCurrentImage(wrapper, imagePath, postSlug) {
  showConfirmation(
    "Remove Image",
    "Are you sure you want to remove this image?",
    () => {
      // Remove from the images to keep list
      imagesToKeep = imagesToKeep.filter((img) => img !== imagePath);

      // Remove the wrapper from DOM
      wrapper.remove();

      // Check if no images left
      const container = document.getElementById("currentImagesContainer");
      if (container.children.length === 0) {
        container.innerHTML = '<p class="no-images">No images in this post</p>';
      }

      showMessage("Image marked for removal", "info");
    }
  );
}

// Image click handler for modal
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

// Handle modify and delete button clicks
document.addEventListener("click", function (e) {
  if (e.target && e.target.classList.contains("modifyBtn")) {
    e.preventDefault();

    const encodedData = e.target.getAttribute("data-post-encoded");
    if (encodedData) {
      try {
        const postDataString = safeBase64Decode(encodedData);
        const postData = JSON.parse(postDataString);
        openModifyPage(postData);
      } catch (error) {
        console.error("Error parsing encoded post data:", error);
        showMessage("Error loading post data", "error");
      }
    } else {
      const postDataString = e.target.getAttribute("data-post");
      try {
        const postData = JSON.parse(postDataString);
        openModifyPage(postData);
      } catch (error) {
        console.error("Error parsing post data:", error);
        showMessage("Error loading post data", "error");
      }
    }
  }
});

async function deletePost(slug, isDraft) {
  const token = localStorage.getItem("jwtToken");

  showConfirmation(
    "Delete Post",
    "Are you sure you want to delete this post? This action cannot be undone.",
    async () => {
      try {
        showMessage("Deleting post...", "info");

        const response = await fetch(
          `/api/posts/delete/${slug}`,
          {
            method: "DELETE",
          }
        );

        showMessage("Post deleted successfully!", "success");
        if (isDraft) {
          document.querySelector("#draftsContainer").innerHTML = "";
          fetchDraftPosts();
        } else {
          document.querySelector("#publishedContainer").innerHTML = "";
          fetchPublishedPosts();
        }
      } catch (error) {
        if (error.message !== "Session expired") {
          console.error("Network error:", error);
          showMessage("Network error occurred while deleting the post", "error");
        }
      }
    }
  );
}
function openModifyPage(postData) {
  sessionStorage.setItem("postData", JSON.stringify(postData));
  window.location.href = "/modify-post/" + postData.Slug;
}
