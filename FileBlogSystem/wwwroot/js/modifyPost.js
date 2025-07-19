// Modify Post JavaScript Functionality
let easyMDE;
let originalData = {};
let currentData = {};
let hasChanges = false;

// Get post slug from URL parameters
const urlParams = new URLSearchParams(window.location.search);
const postSlug = urlParams.get("slug");

document.addEventListener("DOMContentLoaded", async function () {
  // Check if user is authenticated
  const token = localStorage.getItem("jwtToken");
  if (!token) {
    window.location.href = "/login.html";
    return;
  }

  // Check if postSlug is provided
  if (!postSlug) {
    alert("No post slug provided");
    window.location.href = "/myProfile.html";
    return;
  }

  // Set up mode toggle
  setupModeToggle();

  // Initialize markdown editor
  initializeMarkdownEditor();

  // Load post data
  await loadPostData();

  // Set up form event listeners
  setupFormEventListeners();

  // Set up navigation buttons
  setupNavigationButtons();
});

function setupModeToggle() {
  const modeToggle = document.getElementById("modeToggle");
  const currentTheme = localStorage.getItem("theme") || "light";

  document.body.classList.toggle("dark-mode", currentTheme === "dark");
  modeToggle.textContent = currentTheme === "dark" ? "🌙" : "☀️";
  modeToggle.setAttribute("data-theme", currentTheme);

  modeToggle.addEventListener("click", function () {
    const isDark = document.body.classList.toggle("dark-mode");
    const newTheme = isDark ? "dark" : "light";

    localStorage.setItem("theme", newTheme);
    modeToggle.textContent = isDark ? "🌙" : "☀️";
    modeToggle.setAttribute("data-theme", newTheme);
  });
}

function initializeMarkdownEditor() {
  easyMDE = new EasyMDE({
    element: document.getElementById("content"),
    placeholder: "Write your post content here using Markdown...",
    spellChecker: false,
    autosave: {
      enabled: true,
      uniqueId: `modify_post_${postSlug}`,
      delay: 10000,
    },
    toolbar: [
      "bold",
      "italic",
      "heading",
      "|",
      "quote",
      "unordered-list",
      "ordered-list",
      "|",
      "link",
      "image",
      "|",
      "preview",
      "side-by-side",
      "fullscreen",
      "|",
      "guide",
    ],
  });

  // Listen for content changes in the markdown editor
  easyMDE.codemirror.on("change", function () {
    checkForChanges();
  });
}

async function loadPostData() {
  try {
    const token = localStorage.getItem("jwtToken");
    const response = await fetch(`/api/posts/${postSlug}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to load post data");
    }

    const post = await response.json();

    // Map backend PascalCase properties to form fields
    originalData = {
      title: post.Title || post.title || "",
      description: post.Description || post.description || "",
      customUrl: post.CustomUrl || post.customUrl || "",
      tags: Array.isArray(post.Tags)
        ? post.Tags.join(", ")
        : post.tags
        ? post.tags.join(", ")
        : post.tags || "",
      categories: Array.isArray(post.Categories)
        ? post.Categories.join(", ")
        : post.categories
        ? post.categories.join(", ")
        : post.categories || "",
      content: post.Content || post.content || "",
      schedulePost:
        post.IsScheduled !== undefined
          ? post.IsScheduled
          : post.isScheduled || false,
      scheduledDate: post.ScheduledDate
        ? new Date(post.ScheduledDate).toISOString().slice(0, 16)
        : post.scheduledDate
        ? new Date(post.scheduledDate).toISOString().slice(0, 16)
        : "",
    };

    // Populate form fields
    document.getElementById("postId").value = postSlug;
    document.getElementById("title").value = originalData.title;
    document.getElementById("description").value = originalData.description;
    document.getElementById("customUrl").value = originalData.customUrl;
    document.getElementById("tags").value = originalData.tags;
    document.getElementById("categories").value = originalData.categories;
    document.getElementById("schedulePost").checked = originalData.schedulePost;
    document.getElementById("scheduledDate").value = originalData.scheduledDate;

    // Set markdown editor content
    easyMDE.value(originalData.content);

    // Update slug preview
    updateSlugPreview(originalData.title);

    // Show/hide schedule input based on checkbox
    toggleScheduleInput();

    // Store current data (initially same as original)
    currentData = { ...originalData };

    console.log("Post data loaded successfully");
  } catch (error) {
    console.error("Error loading post data:", error);
    alert("Failed to load post data. Please try again.");
    window.location.href = "/myProfile.html";
  }
}

function setupFormEventListeners() {
  const form = document.getElementById("modifyPostForm");
  const titleInput = document.getElementById("title");
  const scheduleCheckbox = document.getElementById("schedulePost");

  // Title input - update slug preview
  titleInput.addEventListener("input", function () {
    updateSlugPreview(this.value);
    checkForChanges();
  });

  // All form inputs - check for changes
  const inputs = form.querySelectorAll(
    'input:not([type="file"]), textarea:not(#content)'
  );
  inputs.forEach((input) => {
    input.addEventListener("input", checkForChanges);
    input.addEventListener("change", checkForChanges);
  });

  // Schedule checkbox
  scheduleCheckbox.addEventListener("change", function () {
    toggleScheduleInput();
    checkForChanges();
  });

  // Form submission
  form.addEventListener("submit", handleFormSubmit);

  // Image upload
  const imageInput = document.getElementById("images");
  imageInput.addEventListener("change", handleImageUpload);
}

function setupNavigationButtons() {
  document
    .getElementById("backToBlogBtn")
    .addEventListener("click", function () {
      if (hasChanges) {
        if (
          confirm("You have unsaved changes. Are you sure you want to leave?")
        ) {
          window.location.href = "/blog.html";
        }
      } else {
        window.location.href = "/blog.html";
      }
    });

  document
    .getElementById("backToProfileBtn")
    .addEventListener("click", function () {
      if (hasChanges) {
        if (
          confirm("You have unsaved changes. Are you sure you want to leave?")
        ) {
          window.location.href = "/myProfile.html";
        }
      } else {
        window.location.href = "/myProfile.html";
      }
    });

  document.getElementById("logoutBtn").addEventListener("click", function () {
    if (hasChanges) {
      if (
        confirm("You have unsaved changes. Are you sure you want to logout?")
      ) {
        logout();
      }
    } else {
      logout();
    }
  });

  document.getElementById("cancelBtn").addEventListener("click", function () {
    if (hasChanges) {
      if (
        confirm("You have unsaved changes. Are you sure you want to cancel?")
      ) {
        window.location.href = "/myProfile.html";
      }
    } else {
      window.location.href = "/myProfile.html";
    }
  });

  document
    .getElementById("saveDraftBtn")
    .addEventListener("click", function () {
      saveDraft();
    });
}

function updateSlugPreview(title) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();

  document.getElementById("slugPreview").textContent = `/post/${slug}`;
}

function toggleScheduleInput() {
  const scheduleInput = document.getElementById("scheduleInput");
  const isChecked = document.getElementById("schedulePost").checked;
  scheduleInput.style.display = isChecked ? "block" : "none";
}

function checkForChanges() {
  // Get current form data
  currentData = {
    title: document.getElementById("title").value.trim(),
    description: document.getElementById("description").value.trim(),
    customUrl: document.getElementById("customUrl").value.trim(),
    tags: document.getElementById("tags").value.trim(),
    categories: document.getElementById("categories").value.trim(),
    content: easyMDE.value().trim(),
    schedulePost: document.getElementById("schedulePost").checked,
    scheduledDate: document.getElementById("scheduledDate").value,
  };

  // Check if any field has changed
  hasChanges = false;
  const changedFields = [];

  for (const key in currentData) {
    if (currentData[key] !== originalData[key]) {
      hasChanges = true;
      changedFields.push(key);

      // Add visual indicator for changed fields
      const field = document.getElementById(
        key === "content" ? "content" : key
      );
      if (field && field !== document.getElementById("content")) {
        field.classList.add("modified");
      }
    } else {
      // Remove visual indicator if field matches original
      const field = document.getElementById(
        key === "content" ? "content" : key
      );
      if (field && field !== document.getElementById("content")) {
        field.classList.remove("modified");
      }
    }
  }

  // Update markdown editor styling for content changes
  const contentChanged = currentData.content !== originalData.content;
  const codeMirrorElement = document.querySelector(".CodeMirror");
  if (codeMirrorElement) {
    if (contentChanged) {
      codeMirrorElement.classList.add("modified");
    } else {
      codeMirrorElement.classList.remove("modified");
    }
  }

  // Enable/disable update button
  const updateBtn = document.getElementById("updatePostBtn");
  updateBtn.disabled = !hasChanges;

  // Show/hide changes indicator
  const changesIndicator = document.querySelector(".changes-indicator");
  if (!changesIndicator) {
    createChangesIndicator();
  }

  const indicator = document.querySelector(".changes-indicator");
  if (hasChanges) {
    indicator.textContent = `You have ${changedFields.length} unsaved change${
      changedFields.length === 1 ? "" : "s"
    }`;
    indicator.classList.add("show");
  } else {
    indicator.classList.remove("show");
  }
}

function createChangesIndicator() {
  const indicator = document.createElement("div");
  indicator.className = "changes-indicator";
  const form = document.querySelector(".modify-post-form");
  form.insertBefore(indicator, form.firstChild);
}

async function handleFormSubmit(e) {
  e.preventDefault();

  if (!hasChanges) {
    alert("No changes to save.");
    return;
  }

  const updateBtn = document.getElementById("updatePostBtn");
  updateBtn.classList.add("loading");
  updateBtn.disabled = true;

  try {
    const token = localStorage.getItem("jwtToken");
    const formData = new FormData();

    // Add changed fields only
    for (const key in currentData) {
      if (currentData[key] !== originalData[key]) {
        if (key === "tags" || key === "categories") {
          // Convert comma-separated strings to arrays
          const values = currentData[key]
            .split(",")
            .map((v) => v.trim())
            .filter((v) => v);
          formData.append(key, JSON.stringify(values));
        } else {
          formData.append(key, currentData[key]);
        }
      }
    }

    // Add images if any
    const imageInput = document.getElementById("images");
    if (imageInput.files.length > 0) {
      for (let i = 0; i < imageInput.files.length; i++) {
        formData.append("images", imageInput.files[i]);
      }
    }

    const response = await fetch(`/api/posts/modify/${postSlug}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to update post");
    }

    alert("Post updated successfully!");

    // Update original data to current data
    originalData = { ...currentData };
    hasChanges = false;
    checkForChanges();

    // Optionally redirect to the post or profile
    if (confirm("Post updated! Would you like to view the updated post?")) {
      window.location.href = `/post/${postSlug}`;
    }
  } catch (error) {
    console.error("Error updating post:", error);
    alert("Failed to update post: " + error.message);
  } finally {
    updateBtn.classList.remove("loading");
    updateBtn.disabled = !hasChanges;
  }
}

async function saveDraft() {
  const saveDraftBtn = document.getElementById("saveDraftBtn");
  saveDraftBtn.classList.add("loading");

  try {
    const token = localStorage.getItem("jwtToken");
    const draftData = {
      ...currentData,
      isDraft: true,
    };

    // Convert tags and categories to arrays
    if (draftData.tags) {
      draftData.tags = draftData.tags
        .split(",")
        .map((v) => v.trim())
        .filter((v) => v);
    }
    if (draftData.categories) {
      draftData.categories = draftData.categories
        .split(",")
        .map((v) => v.trim())
        .filter((v) => v);
    }

    const response = await fetch(`/api/posts/modify/${postSlug}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(draftData),
    });

    if (!response.ok) {
      throw new Error("Failed to save draft");
    }

    alert("Draft saved successfully!");
  } catch (error) {
    console.error("Error saving draft:", error);
    alert("Failed to save draft: " + error.message);
  } finally {
    saveDraftBtn.classList.remove("loading");
  }
}

function handleImageUpload(e) {
  const files = e.target.files;
  const previewContainer = document.getElementById("imagePreview");

  // Clear previous previews
  previewContainer.innerHTML = "";

  Array.from(files).forEach((file, index) => {
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = function (e) {
        const previewItem = createImagePreviewItem(
          file.name,
          e.target.result,
          index
        );
        previewContainer.appendChild(previewItem);
      };
      reader.readAsDataURL(file);
    }
  });
}

function createImagePreviewItem(fileName, src, index) {
  const item = document.createElement("div");
  item.className = "image-preview-item";
  item.innerHTML = `
        <div class="image-preview-content">
            <img src="${src}" alt="${fileName}">
            <div class="image-preview-actions">
                <div class="image-name">${fileName}</div>
                <button type="button" class="btn-sm btn-danger" onclick="removeImagePreview(this, ${index})">
                    Remove
                </button>
            </div>
        </div>
    `;
  return item;
}

function removeImagePreview(button, index) {
  const imageInput = document.getElementById("images");
  const dt = new DataTransfer();

  // Rebuild file list without the removed file
  Array.from(imageInput.files).forEach((file, i) => {
    if (i !== index) {
      dt.items.add(file);
    }
  });

  imageInput.files = dt.files;

  // Remove preview item
  button.closest(".image-preview-item").remove();
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "/login.html";
}

// Prevent accidental navigation away with unsaved changes
window.addEventListener("beforeunload", function (e) {
  if (hasChanges) {
    e.preventDefault();
    e.returnValue = "";
    return "";
  }
});

// Add CSS for modified markdown editor
const style = document.createElement("style");
style.textContent = `
    .CodeMirror.modified {
        border-color: var(--warning-color) !important;
        background-color: rgba(184, 134, 11, 0.05) !important;
    }
    
    body.dark-mode .CodeMirror.modified {
        background-color: rgba(212, 184, 150, 0.05) !important;
    }
`;
document.head.appendChild(style);
