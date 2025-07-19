import { renderPosts, safeBase64Decode } from "./utils/renderPost.js";
import { initializeImageModal, openImageModal } from "./utils/imageModal.js";
import { initializeThemeToggle } from "./utils/themeToggle.js";
import { showMessage, showConfirmation } from "./utils/notifications.js";

// Global variables
let currentPost = null;
let imagesToKeep = [];

window.addEventListener("DOMContentLoaded", () => {
  console.log("DOMContentLoaded event fired - myProfile.js is loading");

  // Get username from URL parameters if viewing someone else's profile
  const urlParams = new URLSearchParams(window.location.search);
  const profileUsername = urlParams.get("username");
  console.log("Profile username from URL:", profileUsername);

  // Get current user's username
  const currentUsername = localStorage.getItem("username");
  const token = localStorage.getItem("jwtToken");
  console.log("Current username:", currentUsername);
  console.log("JWT token exists:", !!token);

  // Determine if this is the user's own profile
  const isOwnProfile = !profileUsername || profileUsername === currentUsername;
  const targetUsername = isOwnProfile ? currentUsername : profileUsername;

  // Update page title and header
  const headerElement = document.querySelector("header h1");
  if (isOwnProfile) {
    document.title = "Ather&ink - Your Profile";
    if (headerElement) headerElement.textContent = "Ather&ink - Your Profile";
    // If viewing own profile, ensure URL is clean (can be /my-profile or /profile/{username})
    // Don't change URL if already correct
  } else {
    document.title = `Ather&ink - ${targetUsername}'s Profile`;
    if (headerElement)
      headerElement.textContent = `Ather&ink - ${targetUsername}'s Profile`;
    // Update URL to use profile format for other users
    const expectedUrl = `/profile/${profileUsername}`;
    if (
      window.location.pathname !== expectedUrl &&
      !window.location.pathname.endsWith("myProfile.html")
    ) {
      window.history.replaceState({}, "", expectedUrl);
    }
  }

  // Initialize components
  console.log("Initializing components...");
  initializeImageModal();
  initializeThemeToggle();
  console.log("Components initialized");

  // Make functions globally accessible for onclick handlers
  window.deletePost = deletePost;

  // DOM elements
  const publishedSection = document.getElementById("publishedSection");
  const draftsSection = document.getElementById("draftsSection");
  const publishedBtn = document.querySelector('button[data-tab="published"]');
  const draftsBtn = document.querySelector('button[data-tab="drafts"]');

  // Navigation buttons
  const backToBlogBtn = document.getElementById("backToBlogBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const adminBtn = document.getElementById("adminBtn");

  // User info elements
  const userUsername = document.getElementById("userUsername");
  const userEmail = document.getElementById("userEmail");
  const userProfilePic = document.getElementById("userProfilePic");
  const userRole = document.getElementById("userRole");
  const userMemberSince = document.getElementById("userMemberSince");
  const userPostsCount = document.getElementById("userPostsCount");

  // Edit section elements
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
  adminBtn?.addEventListener("click", () => (window.location.href = "admin"));
  logoutBtn?.addEventListener("click", () => {
    localStorage.removeItem("jwtToken");
    showMessage("Logged out successfully", "info");
    setTimeout(() => {
      window.location.href = "login";
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
  console.log("About to fetch published posts...");
  fetchPublishedPosts(targetUsername);
  if (isOwnProfile) {
    console.log("About to fetch drafts and user info...");
    console.log("Current username for fetchUserInfo:", currentUsername);
    console.log("Token for fetchUserInfo:", token ? "exists" : "missing");
    fetchDrafts();
    fetchUserInfo();
  } else {
    console.log("About to fetch user info for profile...");
    fetchUserInfoForProfile(targetUsername);
  }

  // Helper function to find post by slug
  function findPostBySlug(slug) {
    console.log("findPostBySlug called with slug:", slug);
    // Try to find in the currently loaded posts data
    const publishedContainer = document.getElementById("publishedContainer");
    const draftsContainer = document.getElementById("draftsContainer");

    // Check both containers for the post data
    const allPostCards = [
      ...(publishedContainer?.querySelectorAll(".post-card") || []),
      ...(draftsContainer?.querySelectorAll(".post-card") || []),
    ];

    console.log("Found post cards:", allPostCards.length);

    for (const card of allPostCards) {
      console.log("Checking card with slug:", card.dataset.slug);
      if (card.dataset.slug === slug) {
        console.log("Found matching card for slug:", slug);
        // Try to get the post data from the modify button
        const modifyBtn = card.querySelector(".modifyBtn");
        console.log("Modify button found:", !!modifyBtn);
        if (modifyBtn) {
          const encodedData = modifyBtn.getAttribute("data-post-encoded");
          console.log("Encoded data found:", !!encodedData);
          if (encodedData) {
            try {
              const postDataString = safeBase64Decode(encodedData);
              const postData = JSON.parse(postDataString);
              console.log("Decoded post data:", postData);
              return postData;
            } catch (error) {
              console.error("Error parsing post data:", error);
            }
          }
        }
      }
    }

    console.log("Post not found for slug:", slug);
    return null;
  }

  // Tab switching function
  function switchTab(tab) {
    if (tab === "published") {
      publishedSection?.classList.remove("hidden");
      draftsSection?.classList.add("hidden");
      publishedBtn?.classList.add("active");
      draftsBtn?.classList.remove("active");
    } else if (tab === "drafts") {
      publishedSection?.classList.add("hidden");
      draftsSection?.classList.remove("hidden");
      publishedBtn?.classList.remove("active");
      draftsBtn?.classList.add("active");
    }
  }

  // Posts section click handler with event delegation
  document.addEventListener("click", function (e) {
    // Handle modify button clicks
    if (e.target.classList.contains("modifyBtn")) {
      e.preventDefault();
      const postCard = e.target.closest(".post-card");
      const slug = postCard?.dataset.slug;

      if (slug) {
        console.log("Modify button clicked for slug:", slug);
        // Navigate to modify post page with post slug (not ID)
        window.location.href = `/modifyPost.html?slug=${slug}`;
      } else {
        showMessage("Post slug not found", "error");
      }
    }

    // Handle delete button clicks
    if (e.target.classList.contains("deleteBtn")) {
      e.preventDefault();
      const postCard = e.target.closest(".post-card");
      const slug = postCard?.dataset.slug;

      if (slug) {
        const isDraft = e.target.closest("#draftsContainer") !== null;
        deletePost(slug, isDraft);
      }
    }
  });

  // Fetch and display published posts
  async function fetchPublishedPosts(username) {
    console.log(`fetchPublishedPosts called with username: ${username}`);
    console.log(`Token available: ${!!token}`);

    try {
      const url = `https://localhost:7189/api/posts/user/${username}`;
      console.log(`Making request to: ${url}`);

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log(`Response status: ${response.status}`);

      if (response.ok) {
        const posts = await response.json();
        console.log(`Received ${posts.length} published posts:`, posts);
        renderPosts(posts, "publishedContainer", {
          showDelete: isOwnProfile,
          showModify: isOwnProfile,
          showAuthor: false, // Don't show author since this is a profile page
        });
        console.log("Published posts rendered successfully");
      } else {
        const errorText = await response.text();
        console.error(
          "Failed to fetch published posts. Status:",
          response.status,
          "Error:",
          errorText
        );
        showMessage("Failed to load published posts", "error");
      }
    } catch (error) {
      console.error("Error fetching published posts:", error);
      showMessage("Error loading published posts", "error");
    }
  }

  // Fetch and display drafts (only for own profile)
  async function fetchDrafts() {
    try {
      const response = await fetch("https://localhost:7189/api/posts/drafts", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const drafts = await response.json();
        renderPosts(drafts, "draftsContainer", {
          showDelete: true,
          showModify: true,
          showAuthor: false,
        });
      } else {
        console.error("Failed to fetch drafts");
        showMessage("Failed to load drafts", "error");
      }
    } catch (error) {
      console.error("Error fetching drafts:", error);
      showMessage("Error loading drafts", "error");
    }
  }

  // Fetch user info for own profile
  async function fetchUserInfo() {
    console.log("fetchUserInfo called");
    try {
      const url = `https://localhost:7189/api/users/${currentUsername}`;
      console.log(`Making request to: ${url}`);

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log(`User info response status: ${response.status}`);

      if (response.ok) {
        const user = await response.json();
        console.log("User info received:", user);
        displayUserInfo(user);
      } else {
        const errorText = await response.text();
        console.error(
          "Failed to fetch user info. Status:",
          response.status,
          "Error:",
          errorText
        );
        showMessage("Failed to load user information", "error");
      }
    } catch (error) {
      console.error("Error fetching user info:", error);
      showMessage("Error loading user information", "error");
    }
  }

  // Fetch user info for viewing another user's profile
  async function fetchUserInfoForProfile(username) {
    try {
      const response = await fetch(
        `https://localhost:7189/api/users/${username}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const user = await response.json();
        displayUserInfo(user);
      } else {
        console.error("Failed to fetch user profile info");
        showMessage("Failed to load user profile", "error");
      }
    } catch (error) {
      console.error("Error fetching user profile info:", error);
      showMessage("Error loading user profile", "error");
    }
  }

  // Display user information
  function displayUserInfo(user) {
    console.log("displayUserInfo called with:", user);
    console.log("DOM elements check:");
    console.log("userUsername element:", userUsername);
    console.log("userEmail element:", userEmail);
    console.log("userRole element:", userRole);
    console.log("userMemberSince element:", userMemberSince);
    console.log("userPostsCount element:", userPostsCount);

    if (userUsername) {
      console.log("Setting username to:", user.Username);
      userUsername.textContent = user.Username;
    } else {
      console.error("userUsername element not found!");
    }

    if (userEmail) {
      console.log("Setting email to:", user.Email);
      userEmail.textContent = user.Email;
    } else {
      console.error("userEmail element not found!");
    }

    if (userRole) {
      console.log("Setting role to:", user.Role || "User");
      userRole.textContent = user.Role || "User";

      // Show admin button if user is admin
      if (adminBtn && user.Role === "Admin") {
        adminBtn.style.display = "inline-block";
      }
    } else {
      console.error("userRole element not found!");
    }

    if (userMemberSince) {
      const memberSinceDate = new Date(user.CreatedAt).toLocaleDateString();
      console.log("Setting member since to:", memberSinceDate);
      userMemberSince.textContent = memberSinceDate;
    } else {
      console.error("userMemberSince element not found!");
    }

    if (userPostsCount) {
      console.log("Setting posts count to:", user.PostsCount || "0");
      userPostsCount.textContent = user.PostsCount || "0";
    } else {
      console.error("userPostsCount element not found!");
    }

    // Handle profile picture
    if (userProfilePic && user.ProfilePictureUrl) {
      userProfilePic.src = user.ProfilePictureUrl;
      userProfilePic.classList.remove("hidden");
    }

    // If this is own profile, populate edit forms
    if (isOwnProfile) {
      if (currentEmailInput) currentEmailInput.value = user.Email;
    }
  }

  // Setup edit functionality
  function setupEditFunctionality() {
    // Change email button
    changeEmailBtn?.addEventListener("click", () => {
      hideAllEditSections();
      changeEmailSection?.classList.remove("hidden");
    });

    // Change password button
    changePasswordBtn?.addEventListener("click", () => {
      hideAllEditSections();
      changePasswordSection?.classList.remove("hidden");
    });

    // Change picture button
    changePictureBtn?.addEventListener("click", () => {
      hideAllEditSections();
      changePictureSection?.classList.remove("hidden");

      // Show current profile picture if it exists
      if (
        userProfilePic &&
        userProfilePic.src &&
        !userProfilePic.src.endsWith("/")
      ) {
        if (picturePreview) {
          picturePreview.src = userProfilePic.src;
          picturePreview.classList.remove("hidden");
        }
      }
    });

    // Form submissions
    changeEmailForm?.addEventListener("submit", handleEmailChange);
    changePasswordForm?.addEventListener("submit", handlePasswordChange);
    changePictureForm?.addEventListener("submit", handlePictureChange);

    // Cancel buttons
    document.querySelectorAll(".cancel-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        hideAllEditSections();
      });
    });

    // Picture preview
    newProfilePictureInput?.addEventListener("change", (e) => {
      console.log("File input changed");
      const file = e.target.files[0];
      if (file) {
        console.log("File selected:", file.name, file.type);
        const reader = new FileReader();
        reader.onload = (e) => {
          console.log(
            "File reader loaded, result length:",
            e.target.result.length
          );
          if (picturePreview) {
            picturePreview.src = e.target.result;
            picturePreview.classList.remove("hidden");
            console.log("Picture preview updated and shown");
          } else {
            console.error("Picture preview element not found!");
          }
        };
        reader.readAsDataURL(file);
      } else {
        console.log("No file selected");
      }
    });
  }

  function hideAllEditSections() {
    changeEmailSection?.classList.add("hidden");
    changePasswordSection?.classList.add("hidden");
    changePictureSection?.classList.add("hidden");

    // Reset picture preview when hiding sections
    if (picturePreview) {
      picturePreview.classList.add("hidden");
      picturePreview.src = "";
    }

    // Clear file input
    if (newProfilePictureInput) {
      newProfilePictureInput.value = "";
    }
  }

  // Handle email change
  async function handleEmailChange(e) {
    e.preventDefault();

    const currentEmail = currentEmailInput?.value;
    const newEmail = newEmailInput?.value;
    const password = emailPasswordInput?.value;

    if (!currentEmail || !newEmail || !password) {
      showMessage("All fields are required", "warning");
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
            email: newEmail,
            confirmPassword: password,
          }),
        }
      );

      if (response.ok) {
        showMessage("Email updated successfully", "success");
        hideAllEditSections();
        fetchUserInfo(); // Refresh user info
      } else {
        const error = await response.text();
        showMessage(error || "Failed to update email", "error");
      }
    } catch (error) {
      console.error("Error updating email:", error);
      showMessage("Error updating email", "error");
    }
  }

  // Handle password change
  async function handlePasswordChange(e) {
    e.preventDefault();

    const currentPassword = currentPasswordInput?.value;
    const newPassword = newPasswordInput?.value;
    const confirmPassword = confirmPasswordInput?.value;

    if (!currentPassword || !newPassword || !confirmPassword) {
      showMessage("All fields are required", "warning");
      return;
    }

    if (newPassword !== confirmPassword) {
      showMessage("New passwords do not match", "warning");
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
            currentPassword,
            newPassword,
          }),
        }
      );

      if (response.ok) {
        showMessage("Password updated successfully", "success");
        hideAllEditSections();
        // Clear form
        changePasswordForm?.reset();
      } else {
        const error = await response.text();
        showMessage(error || "Failed to update password", "error");
      }
    } catch (error) {
      console.error("Error updating password:", error);
      showMessage("Error updating password", "error");
    }
  }

  // Handle picture change
  async function handlePictureChange(e) {
    e.preventDefault();

    const file = newProfilePictureInput?.files[0];
    if (!file) {
      showMessage("Please select a picture", "warning");
      return;
    }

    try {
      // Convert file to base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          // Remove the data:image/...;base64, prefix
          const base64Data = result.substring(result.indexOf(",") + 1);
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const response = await fetch(
        `https://localhost:7189/api/users/${currentUsername}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            profilePictureBase64: base64,
            profilePictureFileName: file.name,
          }),
        }
      );

      if (response.ok) {
        showMessage("Profile picture updated successfully", "success");
        hideAllEditSections();
        fetchUserInfo(); // Refresh user info to show new picture
        // Clear form
        changePictureForm?.reset();
        picturePreview?.classList.add("hidden");
      } else {
        const error = await response.text();
        showMessage(error || "Failed to update profile picture", "error");
      }
    } catch (error) {
      console.error("Error updating profile picture:", error);
      showMessage("Error updating profile picture", "error");
    }
  }

  // Delete post function
  async function deletePost(slug, isDraft = false) {
    const confirmed = await showConfirmation(
      "Are you sure you want to delete this post? This action cannot be undone."
    );

    if (!confirmed) return;

    try {
      const endpoint = `https://localhost:7189/api/posts/delete/${slug}`;

      const response = await fetch(endpoint, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        showMessage("Post deleted successfully", "success");
        // Refresh the appropriate section
        if (isDraft) {
          fetchDrafts();
        } else {
          fetchPublishedPosts(targetUsername);
        }
      } else {
        const error = await response.text();
        showMessage(error || "Failed to delete post", "error");
      }
    } catch (error) {
      console.error("Error deleting post:", error);
      showMessage("Error deleting post", "error");
    }
  }
});

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
