import { renderPosts } from "./utils/renderPost.js";
import { initializeImageModal, openImageModal } from "./utils/imageModal.js";
import { initializeThemeToggle } from "./utils/themeToggle.js";
import { showMessage, showConfirmation } from "./utils/notifications.js";

window.addEventListener("DOMContentLoaded", () => {
  // Get username from URL parameters if viewing someone else's profile
  const urlParams = new URLSearchParams(window.location.search);
  const profileUsername = urlParams.get("username");

  // Get current user's username
  const currentUsername = localStorage.getItem("username");
  const token = localStorage.getItem("jwtToken");

  // Determine if this is the user's own profile
  const isOwnProfile = !profileUsername || profileUsername === currentUsername;
  const targetUsername = isOwnProfile ? currentUsername : profileUsername;

  // Add these global variables for image tracking
  let currentPost = null;
  let imagesToKeep = [];

  // Update page title
  document.title = isOwnProfile ? "My Profile" : `${targetUsername}'s Profile`;

  // Initialize components
  initializeImageModal();
  initializeThemeToggle();

  // DOM elements
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
    () => (window.location.href = "blog")
  );
  logoutBtn?.addEventListener("click", () => {
    localStorage.removeItem("jwtToken");
    showMessage("Logged out successfully", "info");
    setTimeout(() => {
      window.location.href = "login";
    }, 1000);
  });

  // Modal close event
  closeModifyModal?.addEventListener("click", () => {
    modifyPostModal?.classList.add("hidden");
  });

  // Cancel modify button
  document.getElementById("cancelModify")?.addEventListener("click", () => {
    modifyPostModal?.classList.add("hidden");
  });

  // Post modification form submission
  modifyPostForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await submitModification();
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
        img.src = `https://localhost:7189/Content/posts/${dateOnly}-${post.Slug}${imagePath}`;
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
      const endpoint = `https://localhost:7189/api/posts/user/${username}`;
      console.log(`Fetching posts from: ${endpoint}`);

      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log(`Response status: ${response.status}`);
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Error response: ${errorText}`);
        throw new Error(`Failed to fetch posts: ${response.status}`);
      }

      const posts = await response.json();
      console.log(`Fetched ${posts.length} posts for user: ${username}`, posts);

      renderPosts(posts, "publishedContainer", {
        showDelete: isOwnProfile,
        showModify: isOwnProfile,
        showActions: true,
      });
    } catch (error) {
      console.error("Error fetching published posts:", error);
      document.getElementById("publishedContainer").innerHTML =
        '<p class="error-message">Failed to load posts</p>';
      showMessage("Failed to load published posts", "error");
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
        showActions: true,
      });
    } catch (error) {
      console.error("Error fetching draft posts:", error);
      showMessage("Failed to load draft posts", "error");
    }
  }

  async function loadUserInfo(username = currentUsername) {
    try {
      const response = await fetch(
        `https://localhost:7189/api/users/${username}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch user info");

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
        userProfilePic.src = `https://localhost:7189${user.ProfilePictureUrl}`;
        userProfilePic.onerror = function () {
          this.src = "placeholders/profile.png";
          this.onerror = null;
        };
        userProfilePic.classList.remove("hidden");
      } else {
        userProfilePic.src = "placeholders/profile.png";
        userProfilePic.classList.remove("hidden");
      }
    } catch (err) {
      console.error("Error loading user info:", err);
      userUsername.textContent = username;
      userRole.textContent = "User";
      userMemberSince.textContent = "";
      userPostsCount.textContent = "0";
      userProfilePic.src = "placeholders/profile.png";
      showMessage("Failed to load user information", "error");
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
        showMessage("Email updated successfully!", "success");
        toggleEditSection("email", false);
        loadUserInfo(targetUsername);
      } else {
        const error = await response.json();
        showError("newEmail", error.message || "Failed to update email.");
      }
    } catch (err) {
      showError("newEmail", "Network error. Please try again.");
      showMessage("Network error occurred while updating email", "error");
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
        showMessage("Password updated successfully!", "success");
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
      showMessage("Network error occurred while updating password", "error");
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
        `https://localhost:7189/api/users/${currentUsername}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ProfilePictureBase64: base64Image.split(",")[1],
            ProfilePictureFileName: file.name,
          }),
        }
      );

      if (response.ok) {
        showMessage("Profile picture updated successfully!", "success");
        toggleEditSection("picture", false);
        loadUserInfo(targetUsername);
      } else {
        const error = await response.json();
        errorEl.textContent = error.message || "Failed to update.";
      }
    } catch (err) {
      errorEl.textContent = "Network error. Please try again.";
      showMessage(
        "Network error occurred while updating profile picture",
        "error"
      );
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

  async function submitModification() {
    const form = document.getElementById("modifyPostForm");
    const formData = new FormData();
    const slug = document.getElementById("postSlug").value;

    // Get form values manually to ensure correct naming
    const title = document.getElementById("modifyTitle").value.trim();
    const description = document
      .getElementById("modifyDescription")
      .value.trim();
    const body = document.getElementById("modifyBody").value.trim();
    const tags = document.getElementById("modifyTags").value.trim();
    const categories = document.getElementById("modifyCategories").value.trim();

    // Validate required fields
    if (!title) {
      showMessage("Title is required", "warning");
      return;
    }
    if (!description) {
      showMessage("Description is required", "warning");
      return;
    }
    if (!body) {
      showMessage("Body content is required", "warning");
      return;
    }

    // Add all fields to formData
    formData.append("Title", title);
    formData.append("Description", description);
    formData.append("Body", body);
    formData.append("Tags", tags);
    formData.append("Categories", categories);
    formData.append("IsPublished", "true");

    // Add kept images (images that weren't removed)
    if (imagesToKeep && imagesToKeep.length > 0) {
      imagesToKeep.forEach((imagePath) => {
        formData.append("KeptImages", imagePath);
      });
    }

    // Add any new images from file input
    const imageFiles = document.getElementById("modifyImages").files;
    if (imageFiles.length > 0) {
      for (let i = 0; i < imageFiles.length; i++) {
        formData.append("Images", imageFiles[i]);
      }
    }

    try {
      showMessage("Updating post...", "info");

      const response = await fetch(
        `https://localhost:7189/api/posts/modify/${slug}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      if (response.ok) {
        const result = await response.json();
        showMessage("Post updated successfully!", "success");
        modifyPostModal.classList.add("hidden");

        // Reset the tracking variables
        currentPost = null;
        imagesToKeep = [];

        // Refresh the post lists
        if (isOwnProfile) {
          fetchDraftPosts();
        }
        fetchPublishedPosts(targetUsername);
      } else {
        const errorText = await response.text();
        console.error("Server response:", errorText);

        try {
          const errorJson = JSON.parse(errorText);
          showMessage(
            "Error: " +
              (errorJson.message || errorJson.title || "Unknown error"),
            "error"
          );
        } catch {
          showMessage(
            `Error updating post (${response.status}): ${errorText}`,
            "error"
          );
        }
      }
    } catch (error) {
      console.error("Network error:", error);
      showMessage("Network error occurred while updating the post", "error");
    }
  }

  // Update the openModifyModal function
  function openModifyModal(post) {
    console.log("Opening modify modal with post:", post);

    // Store the current post for reference
    currentPost = post;
    // Initialize with all current images
    imagesToKeep = [...(post.Images || [])];

    document.getElementById("modifyTitle").value = post.Title || "";
    document.getElementById("modifyDescription").value = post.Description || "";
    document.getElementById("modifyBody").value = post.Body || "";
    document.getElementById("modifyTags").value = post.Tags?.join(", ") || "";
    document.getElementById("modifyCategories").value =
      post.Categories?.join(", ") || "";
    document.getElementById("postSlug").value = post.Slug || "";

    // Display current images
    displayCurrentImages(post);

    modifyPostModal.classList.remove("hidden");
  }

  // Update the removeCurrentImage function
  function removeCurrentImage(wrapper, imagePath, postSlug) {
    // Create a custom confirmation dialog
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
        <h3 style="margin: 0 0 15px 0;">Remove Image</h3>
        <p style="margin: 0 0 20px 0;">Are you sure you want to remove this image?</p>
        <div style="display: flex; gap: 10px; justify-content: center;">
          <button id="confirmRemove" style="
            background: #dc3545;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
          ">Remove</button>
          <button id="cancelRemove" style="
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

    document.getElementById("confirmRemove").onclick = () => {
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
      confirmDialog.remove();
    };

    document.getElementById("cancelRemove").onclick = () => {
      confirmDialog.remove();
    };
  }

  // Make sure these functions are accessible globally within this scope
  window.openModifyModal = openModifyModal;
  window.removeCurrentImage = removeCurrentImage;
  window.submitModification = submitModification;

  // ...rest of the existing code...
});

// These functions need to be outside the DOMContentLoaded for global access
function openModifyModal(post) {
  console.log("Opening modify modal with post:", post);

  document.getElementById("modifyTitle").value = post.Title || "";
  document.getElementById("modifyDescription").value = post.Description || "";
  document.getElementById("modifyBody").value = post.Body || "";
  document.getElementById("modifyTags").value = post.Tags?.join(", ") || "";
  document.getElementById("modifyCategories").value =
    post.Categories?.join(", ") || "";
  document.getElementById("postSlug").value = post.Slug || "";

  // Initialize tracking variables
  window.currentPost = post;
  window.imagesToKeep = [...(post.Images || [])];

  // Display current images
  displayCurrentImages(post);

  document.getElementById("modifyPostModal").classList.remove("hidden");
}

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
      img.src = `https://localhost:7189/Content/posts/${dateOnly}-${post.Slug}${imagePath}`;
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
  // Create a custom confirmation dialog
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
      <h3 style="margin: 0 0 15px 0;">Remove Image</h3>
      <p style="margin: 0 0 20px 0;">Are you sure you want to remove this image?</p>
      <div style="display: flex; gap: 10px; justify-content: center;">
        <button id="confirmRemove" style="
          background: #dc3545;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
        ">Remove</button>
        <button id="cancelRemove" style="
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

  document.getElementById("confirmRemove").onclick = () => {
    // Remove from the images to keep list
    if (window.imagesToKeep) {
      window.imagesToKeep = window.imagesToKeep.filter(
        (img) => img !== imagePath
      );
    }

    // Remove the wrapper from DOM
    wrapper.remove();

    // Check if no images left
    const container = document.getElementById("currentImagesContainer");
    if (container.children.length === 0) {
      container.innerHTML = '<p class="no-images">No images in this post</p>';
    }

    showMessage("Image marked for removal", "info");
    confirmDialog.remove();
  };

  document.getElementById("cancelRemove").onclick = () => {
    confirmDialog.remove();
  };
}

// ...rest of the existing code...
