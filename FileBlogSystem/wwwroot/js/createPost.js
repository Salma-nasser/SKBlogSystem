import { initializeThemeToggle } from "./utils/themeToggle.js";
import { showMessage } from "./utils/notifications.js";
import { authenticatedFetch, HttpError } from "./utils/api.js";

let easyMDE;
let selectedFiles = [];

window.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("jwtToken");
  if (!token) {
    window.location.href = "/login";
    return;
  }
  const logoutBtn = document.querySelector(
    'a[href="/logout"], .header-buttons .btn[href="/logout"]'
  );
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function (e) {
      localStorage.removeItem("jwtToken");
      localStorage.removeItem("username");
    });
  }

  initializeThemeToggle();
  initializeMarkdownEditor();
  setupEventListeners();
  setupImagePreview();
  initializeSlugPreview();
});

function initializeSlugPreview() {
  const titleInput = document.getElementById("title");
  const customUrlInput = document.getElementById("customUrl");
  const slugPreview = document.getElementById("slugPreview");

  if (!titleInput || !slugPreview) return;

  function updateSlugPreview() {
    // Check if custom URL is provided first
    const customUrl = customUrlInput?.value.trim();
    if (customUrl) {
      // Clean the custom URL to ensure it's URL-safe
      const cleanedCustomUrl = customUrl
        .replace(/[^\w\s-]/g, "") // Remove special characters except word chars, spaces, and hyphens
        .replace(/\s+/g, "-") // Replace spaces with hyphens
        .toLowerCase() // Convert to lowercase
        .replace(/--+/g, "-") // Replace multiple hyphens with single hyphen
        .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens

      slugPreview.textContent = `/post/${cleanedCustomUrl}`;
      return;
    }

    // Fallback to title-based slug
    const title = titleInput.value.trim();
    if (title) {
      const slug = title
        .replace(/[^\w\s-]/g, "") // Remove special characters except word chars, spaces, and hyphens
        .replace(/\s+/g, "-") // Replace spaces with hyphens
        .toLowerCase() // Convert to lowercase
        .replace(/--+/g, "-") // Replace multiple hyphens with single hyphen
        .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
      slugPreview.textContent = `/post/${slug}`;
    } else {
      slugPreview.textContent = "/post/your-post-title";
    }
  }

  titleInput.addEventListener("input", updateSlugPreview);
  if (customUrlInput) {
    customUrlInput.addEventListener("input", updateSlugPreview);
  }
  updateSlugPreview();
}

function initializeMarkdownEditor() {
  const textarea = document.getElementById("body");
  if (!textarea) return;

  easyMDE = new EasyMDE({
    element: textarea,
    placeholder: "Write your post content here using Markdown...",
    spellChecker: false,
    autofocus: false,
    minHeight: "300px",
    maxHeight: "600px",
    toolbar: [
      "bold",
      "italic",
      "heading",
      "|",
      "quote",
      "code",
      "unordered-list",
      "ordered-list",
      "|",
      "link",
      "table",
      "|",
      "preview",
      "side-by-side",
      "fullscreen",
      "|",
      "guide",
    ],
    status: ["lines", "words", "cursor"],
    renderingConfig: {
      singleLineBreaks: false,
      codeSyntaxHighlighting: true,
    },
  });
}

function setupEventListeners() {
  document.getElementById("backToBlogBtn")?.addEventListener("click", () => {
    window.location.href = "/blog";
  });

  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    logout();
  });

  document
    .getElementById("createPostForm")
    ?.addEventListener("submit", handlePublish);
  document
    .getElementById("saveDraftBtn")
    ?.addEventListener("click", handleSaveDraft);

  document.getElementById("schedulePost")?.addEventListener("change", (e) => {
    const scheduleDiv = document.getElementById("scheduleDateTime");
    if (e.target.checked) {
      scheduleDiv.style.display = "block";
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      document.getElementById("scheduledDate").min = now
        .toISOString()
        .slice(0, 16);
    } else {
      scheduleDiv.style.display = "none";
    }
  });
}

function setupImagePreview() {
  const imageInput = document.getElementById("images");
  const previewContainer = document.getElementById("imagePreview");

  imageInput?.addEventListener("change", (e) => {
    selectedFiles = Array.from(e.target.files).slice(0, 1); // Limit to one image
    displayImagePreviews();
  });

  function displayImagePreviews() {
    previewContainer.innerHTML = "";

    selectedFiles.forEach((file, index) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const previewItem = document.createElement("div");
          previewItem.className = "image-preview-item";

          previewItem.innerHTML = `
            <div class="image-preview-content">
              <img src="${e.target.result}" alt="Preview ${index + 1}">
              <div class="image-preview-actions">
                <span class="image-name">${file.name}</span>
                <button type="button" class="btn btn-sm btn-danger remove-image" 
                        onclick="removeImage(${index})">
                  ❌ Remove
                </button>
              </div>
            </div>
          `;
          previewContainer.appendChild(previewItem);
        };
        reader.readAsDataURL(file);
      }
    });
  }

  window.removeImage = (index) => {
    selectedFiles.splice(index, 1);
    displayImagePreviews();

    const dt = new DataTransfer();
    selectedFiles.forEach((file) => dt.items.add(file));
    imageInput.files = dt.files;
  };
}

// Helper function to generate slug from title or custom URL
function generateSlugForImages() {
  const customUrl = document.getElementById("customUrl")?.value.trim();
  if (customUrl) {
    return customUrl
      .replace(/[^\w\s-]/g, "") // Remove special characters except word chars, spaces, and hyphens
      .replace(/\s+/g, "-") // Replace spaces with hyphens
      .toLowerCase() // Convert to lowercase
      .replace(/--+/g, "-") // Replace multiple hyphens with single hyphen
      .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
  }

  const title = document.getElementById("title").value.trim();
  return title
    ? title
        .replace(/[^\w\s-]/g, "") // Remove special characters except word chars, spaces, and hyphens
        .replace(/\s+/g, "-") // Replace spaces with hyphens
        .toLowerCase() // Convert to lowercase
        .replace(/--+/g, "-") // Replace multiple hyphens with single hyphen
        .replace(/^-+|-+$/g, "") // Remove leading/trailing hyphens
    : "your-post-slug";
}

function copyImageMarkdown(fileName, altText) {
  const slug = generateSlugForImages();
  const today = new Date().toISOString().split("T")[0];

  const imageUrl = `/Content/posts/${today}-${slug}/assets/${fileName}`;
  const markdown = `![${altText}](${imageUrl})`;

  navigator.clipboard
    .writeText(markdown)
    .then(() => {
      showMessage(`Image markdown copied to clipboard!`, "success");
    })
    .catch((err) => {
      console.error("Failed to copy: ", err);
      showMessage("Failed to copy to clipboard", "error");
    });
}

function insertImageIntoPost(fileName, altText) {
  if (!easyMDE) {
    showMessage("Markdown editor not ready", "error");
    return;
  }

  const slug = generateSlugForImages();
  const today = new Date().toISOString().split("T")[0];

  const imageUrl = `/Content/posts/${today}-${slug}/assets/${fileName}`;
  const markdown = `![${altText}](${imageUrl})`;

  // Insert at cursor position
  const cm = easyMDE.codemirror;
  const cursor = cm.getCursor();
  cm.replaceRange(markdown, cursor);

  showMessage(`Image inserted into post!`, "success");
}

function updateImagePreviewsWithActualUrls(postResult) {
  const previewContainer = document.getElementById("imagePreview");
  const copyButtons = previewContainer.querySelectorAll(".copy-url-btn");
  const insertButtons = previewContainer.querySelectorAll(".insert-btn");

  copyButtons.forEach((button, index) => {
    if (postResult.Images[index]) {
      const actualUrl = `/Content/posts/${postResult.Date.split("T")[0]}-${
        postResult.Slug
      }${postResult.Images[index]}`;
      const altText = button.dataset.alt;

      button.onclick = () => {
        const markdown = `![${altText}](${actualUrl})`;
        navigator.clipboard
          .writeText(markdown)
          .then(() => {
            showMessage(`Actual image URL copied to clipboard!`, "success");
          })
          .catch((err) => {
            console.error("Failed to copy: ", err);
            showMessage("Failed to copy to clipboard", "error");
          });
      };

      button.textContent = "📋 Copy Final URL";
      button.classList.add("btn-success");
      button.classList.remove("btn-secondary");
    }
  });

  insertButtons.forEach((button, index) => {
    if (postResult.Images[index]) {
      const actualUrl = `/Content/posts/${postResult.Date.split("T")[0]}-${
        postResult.Slug
      }${postResult.Images[index]}`;
      const altText = button.dataset.alt;

      button.onclick = () => {
        if (!easyMDE) {
          showMessage("Markdown editor not ready", "error");
          return;
        }

        const markdown = `![${altText}](${actualUrl})`;
        const cm = easyMDE.codemirror;
        const cursor = cm.getCursor();
        cm.replaceRange(markdown, cursor);

        showMessage(`Final image URL inserted!`, "success");
      };

      button.textContent = "➕ Insert Final URL";
      button.classList.add("btn-success");
      button.classList.remove("btn-primary");
    }
  });
}

async function handlePublish(e) {
  e.preventDefault();
  await submitPost(true);
}

async function handleSaveDraft() {
  await submitPost(false);
}

async function submitPost(isPublished) {
  const form = document.getElementById("createPostForm");
  const publishBtn = document.getElementById("publishBtn");
  const draftBtn = document.getElementById("saveDraftBtn");

  // Disable buttons and show loading
  publishBtn.disabled = true;
  draftBtn.disabled = true;
  publishBtn.classList.add("loading");
  draftBtn.classList.add("loading");

  try {
    const formData = new FormData();

    // Get form values
    const title = document.getElementById("title").value.trim();
    const description = document.getElementById("description").value.trim();
    const customUrl = document.getElementById("customUrl").value.trim();
    const tags = document.getElementById("tags").value.trim();
    const categories = document.getElementById("categories").value.trim();
    const schedulePost = document.getElementById("schedulePost").checked;
    const scheduledDate = document.getElementById("scheduledDate").value;

    // Get markdown content
    const body = easyMDE.value().trim();

    // Validation
    if (!title) {
      throw new Error("Title is required");
    }
    if (!description) {
      throw new Error("Description is required");
    }
    if (!body) {
      throw new Error("Content is required");
    }

    // Add form data (using proper case to match backend expectations)
    formData.append("Title", title);
    formData.append("Description", description);
    formData.append("Body", body);
    formData.append("CustomUrl", customUrl);
    formData.append("Tags", tags);
    formData.append("Categories", categories);
    formData.append("IsPublished", isPublished.toString());

    // Add scheduled date if applicable
    if (schedulePost && scheduledDate && isPublished) {
      formData.append("ScheduledDate", scheduledDate);
    }

    // Add images
    selectedFiles.forEach((file) => {
      formData.append("Images", file);
    });

    const response = await authenticatedFetch(
      "/api/posts/create",
      {
        method: "POST",
        body: formData,
      }
    );

    const result = await response.json();

    let message = isPublished
      ? schedulePost && scheduledDate
        ? "Post scheduled successfully!"
        : "Post published successfully!"
      : "Draft saved successfully!";

    if (selectedFiles.length > 0 && result.Images && result.Images.length > 0) {
      message += "\n\nYour images are available at:";
      result.Images.forEach((imageUrl, index) => {
        const fileName = selectedFiles[index]?.name || `Image ${index + 1}`;
        message += `\n• ${fileName}: /Content/posts/${
          result.Date.split("T")[0]
        }-${result.Slug}${imageUrl}`;
      });
    }

    showMessage(message, "success");

    // Also update the image previews with the actual URLs
    if (result.Images && result.Images.length > 0) {
      updateImagePreviewsWithActualUrls(result);
    }

    // Redirect to blog page after successful submission
    setTimeout(() => {
      window.location.href = "/blog";
    }, 1500);
  } catch (error) {
    if (error instanceof HttpError) {
      if (error.message === "Session expired") {
        return;
      }
      const errorData = await error.response.json();
      const errorMessage =
        errorData.message ||
        errorData.title ||
        `HTTP error! status: ${error.response.status}`;
      showMessage(errorMessage, "error");
    } else {
      console.error("Error submitting post:", error);
      showMessage(
        error.message || "Failed to submit post. Please try again.",
        "error"
      );
    }
  } finally {
    // Re-enable buttons
    publishBtn.disabled = false;
    draftBtn.disabled = false;
    publishBtn.classList.remove("loading");
    draftBtn.classList.remove("loading");
  }
}

function hasContent() {
  const title = document.getElementById("title").value.trim();
  const description = document.getElementById("description").value.trim();
  const body = easyMDE ? easyMDE.value().trim() : "";

  return title || description || body || selectedFiles.length > 0;
}

function logout() {
  localStorage.removeItem("jwtToken");
  localStorage.removeItem("username");
  showMessage("Logged out successfully", "info");
  setTimeout(() => {
    window.location.href = "/login";
  }, 1000);
}
