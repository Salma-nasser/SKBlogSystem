import { renderPosts } from "./utils/renderPost.js";
import { initializeImageModal, openImageModal } from "./utils/imageModal.js";
import { initializeThemeToggle } from "./utils/themeToggle.js";

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
    window.location.href = "login";
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

    // Check if container exists, if not, create it or handle gracefully
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

    // Check if container exists
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
    // Only allow edit sections for own profile
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
      const endpoint = `https://localhost:7189/api/posts/user`;
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

      // Remove the onModify callback since we're using event delegation
      renderPosts(posts, "publishedContainer", {
        showDelete: isOwnProfile,
        showModify: isOwnProfile,
        showActions: true,
        // Remove onDelete and onModify callbacks - we handle these with event delegation
      });
    } catch (error) {
      console.error("Error fetching published posts:", error);
      document.getElementById("publishedContainer").innerHTML =
        '<p class="error-message">Failed to load posts</p>';
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
        // Remove callbacks - using event delegation
      });
    } catch (error) {
      console.error("Error fetching draft posts:", error);
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
          // If the profile picture fails to load, fallback to placeholder
          this.src = "placeholders/profile.png";
          this.onerror = null; // Prevent infinite loop
        };
        userProfilePic.classList.remove("hidden");
      } else {
        userProfilePic.src = "placeholders/profile.png";
        userProfilePic.classList.remove("hidden");
      }
    } catch (err) {
      console.error("Error loading user info:", err);
      // Show error message or fallback
      userUsername.textContent = username;
      userRole.textContent = "User";
      userMemberSince.textContent = "";
      userPostsCount.textContent = "0";
      userProfilePic.src = "placeholders/profile.png";
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
        loadUserInfo(targetUsername);
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
        loadUserInfo(targetUsername);
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
    console.log("Opening modify modal with post:", post);
    console.log("Post body content:", post.Body); // Debug the body specifically

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

  function displayCurrentImages(post) {
    const container = document.getElementById("currentImagesContainer");

    // Check if container exists, if not, create it or handle gracefully
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
    if (confirm("Are you sure you want to remove this image?")) {
      // Here you would typically make an API call to remove the image
      // For now, just remove it from the UI
      wrapper.remove();

      // Check if no images left
      const container = document.getElementById("currentImagesContainer");
      if (container.children.length === 0) {
        container.innerHTML = '<p class="no-images">No images in this post</p>';
      }
    }
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
      alert("Title is required");
      return;
    }
    if (!description) {
      alert("Description is required");
      return;
    }
    if (!body) {
      alert("Body is required");
      return;
    }

    // Add all fields to formData with exact names expected by backend
    formData.append("Title", title);
    formData.append("Description", description);
    formData.append("Body", body);
    formData.append("Tags", tags);
    formData.append("Categories", categories);
    formData.append("IsPublished", "true");

    // Only add scheduled date if it has a value
    if (scheduledDate) {
      formData.append("ScheduledDate", scheduledDate);
    }

    // Add any new images
    const imageFiles = document.getElementById("modifyImages").files;
    if (imageFiles.length > 0) {
      for (let i = 0; i < imageFiles.length; i++) {
        formData.append("Images", imageFiles[i]);
      }
    }

    // Log form data for debugging
    console.log("Submitting modification for slug:", slug);
    for (let [key, value] of formData.entries()) {
      console.log(`${key}:`, value);
    }

    try {
      const response = await fetch(
        `https://localhost:7189/api/posts/modify/${slug}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            // Don't set Content-Type when using FormData - let browser set it with boundary
          },
          body: formData,
        }
      );

      if (response.ok) {
        const result = await response.json();
        alert("Post updated successfully!");
        modifyPostModal.classList.add("hidden");
        fetchDraftPosts();
        fetchPublishedPosts(targetUsername);
      } else {
        const errorText = await response.text();
        console.error("Server response:", errorText);
        console.error("Response status:", response.status);

        try {
          const errorJson = JSON.parse(errorText);
          alert(
            "Error: " +
              (errorJson.message || errorJson.title || "Unknown error")
          );
        } catch {
          alert(`Error updating post (${response.status}): ${errorText}`);
        }
      }
    } catch (error) {
      console.error("Network error:", error);
      alert("Network error occurred while updating the post");
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

// Handle modify button clicks - move this outside DOMContentLoaded or use event delegation properly
document.addEventListener("click", function (e) {
  if (e.target && e.target.classList.contains("modifyBtn")) {
    e.preventDefault();
    const postDataString = e.target.getAttribute("data-post");
    try {
      const postData = JSON.parse(postDataString);
      console.log("Opening modify modal with post data:", postData); // Debug log
      openModifyModal(postData);
    } catch (error) {
      console.error("Error parsing post data:", error);
    }
  }

  if (e.target && e.target.classList.contains("deleteBtn")) {
    e.preventDefault();
    const slug = e.target.getAttribute("data-slug");
    const isDraft = e.target.closest("#draftsContainer") !== null;
    deletePost(slug, isDraft);
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
