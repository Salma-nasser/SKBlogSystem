import { showMessage, showConfirmation } from "./utils/notifications.js";
import { initializeThemeToggle } from "./utils/themeToggle.js";
import { initMobileSidebar } from "./utils/mobileSidebar.js";
import { authenticatedFetch, HttpError } from "./utils/api.js";

let easyMDE;
let imagesToKeep = [];
let postImages = [];
let dateOnly = "";
let token = "";
const updateBtn = document.getElementById("updatePostBtn");
let postSlug = "";
let username = "";
function enableUpdateButton() {
  if (updateBtn) {
    updateBtn.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // Logout button handler: remove jwtToken and username from localStorage
  const logoutBtn = document.querySelector(
    'a[href="/logout"], .header-buttons .btn[href="/logout"]'
  );
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function (e) {
      localStorage.removeItem("jwtToken");
      localStorage.removeItem("username");
    });
  }
  const raw = sessionStorage.getItem("postData");
  token = localStorage.getItem("jwtToken");
  username = localStorage.getItem("username");
  // Unified image preview container for both existing and new images
  const imagesInput = document.getElementById("images");
  let unifiedPreview = document.getElementById("unifiedImagePreview");
  if (!unifiedPreview) {
    unifiedPreview = document.createElement("div");
    unifiedPreview.id = "unifiedImagePreview";
    unifiedPreview.style.display = "flex";
    unifiedPreview.style.flexWrap = "wrap";
    unifiedPreview.style.gap = "16px";
    unifiedPreview.style.marginBottom = "16px";
    imagesInput?.parentNode?.insertBefore(
      unifiedPreview,
      imagesInput.nextSibling
    );
  }

  imagesInput?.addEventListener("change", function () {
    renderUnifiedPreview();
    enableUpdateButton();
  });

  function renderUnifiedPreview() {
    unifiedPreview.innerHTML = "";
    // Existing images
    imagesToKeep.forEach((img, idx) => {
      const wrapper = document.createElement("div");
      wrapper.className = "image-thumb-wrapper";
      wrapper.style.display = "flex";
      wrapper.style.flexDirection = "column";
      wrapper.style.alignItems = "center";
      wrapper.style.width = "120px";
      // Image
      const imgEl = document.createElement("img");
      // Use backend-provided URL if absolute; otherwise map legacy path to secure endpoint by filename
      if (
        typeof img === "string" &&
        (img.startsWith("http://") ||
          img.startsWith("https://") ||
          img.startsWith("/api/posts/"))
      ) {
        imgEl.src = img;
      } else {
        const str = String(img || "");
        const parts = str.split("/");
        const fileName = parts[parts.length - 1];
        imgEl.src = `/api/posts/${postSlug}/assets/${fileName}`;
      }
      imgEl.alt = "Post image";
      imgEl.className = "preview-thumb";
      imgEl.style.width = "120px";
      imgEl.style.height = "120px";
      imgEl.style.objectFit = "cover";
      // Remove button
      const removeBtn = document.createElement("button");
      removeBtn.className = "remove-image-btn btn";
      removeBtn.type = "button";
      removeBtn.innerHTML = "✖";
      removeBtn.title = "Remove this image";
      removeBtn.style.marginTop = "8px";
      removeBtn.style.background = "#a05a1c";
      removeBtn.style.color = "#fff";
      removeBtn.style.border = "none";
      removeBtn.style.borderRadius = "50%";
      removeBtn.style.width = "36px";
      removeBtn.style.height = "36px";
      removeBtn.style.fontSize = "1.5rem";
      removeBtn.style.display = "flex";
      removeBtn.style.alignItems = "center";
      removeBtn.style.justifyContent = "center";
      removeBtn.style.cursor = "pointer";
      removeBtn.onclick = () => {
        imagesToKeep = imagesToKeep.filter((i) => i !== img);
        renderUnifiedPreview();
        enableUpdateButton();
      };
      wrapper.appendChild(imgEl);
      wrapper.appendChild(removeBtn);
      unifiedPreview.appendChild(wrapper);
    });
    // New images
    const files = imagesInput?.files;
    if (files && files.length > 0) {
      Array.from(files).forEach((file, idx) => {
        if (!file.type.startsWith("image/")) return;
        const reader = new FileReader();
        reader.onload = (e) => {
          const wrapper = document.createElement("div");
          wrapper.className = "image-thumb-wrapper new-upload";
          wrapper.style.display = "flex";
          wrapper.style.flexDirection = "column";
          wrapper.style.alignItems = "center";
          wrapper.style.width = "120px";
          const img = document.createElement("img");
          img.src = e.target.result;
          img.alt = file.name;
          img.className = "preview-thumb";
          img.style.width = "120px";
          img.style.height = "120px";
          img.style.objectFit = "cover";
          const removeBtn = document.createElement("button");
          removeBtn.className = "remove-image-btn btn";
          removeBtn.type = "button";
          removeBtn.innerHTML = "✖";
          removeBtn.title = "Remove this image";
          removeBtn.style.marginTop = "8px";
          removeBtn.style.background = "#a05a1c";
          removeBtn.style.color = "#fff";
          removeBtn.style.border = "none";
          removeBtn.style.borderRadius = "50%";
          removeBtn.style.width = "36px";
          removeBtn.style.height = "36px";
          removeBtn.style.fontSize = "1.5rem";
          removeBtn.style.display = "flex";
          removeBtn.style.alignItems = "center";
          removeBtn.style.justifyContent = "center";
          removeBtn.style.cursor = "pointer";
          removeBtn.onclick = () => {
            removeNewImage(idx);
          };
          wrapper.appendChild(img);
          wrapper.appendChild(removeBtn);
          unifiedPreview.appendChild(wrapper);
        };
        reader.readAsDataURL(file);
      });
    }
  }

  function removeNewImage(idx) {
    const imagesInput = document.getElementById("images");
    if (!imagesInput || !imagesInput.files) return;
    const dt = new DataTransfer();
    Array.from(imagesInput.files).forEach((file, i) => {
      if (i !== idx) dt.items.add(file);
    });
    imagesInput.files = dt.files;
    renderUnifiedPreview();
    enableUpdateButton();
  }

  if (raw) {
    const post = JSON.parse(raw);

    document.getElementById("title").value = post.Title || "";
    document.getElementById("description").value = post.Description || "";
    document.getElementById("customUrl").value = post.CustomUrl || "";
    document.getElementById("tags").value = (post.Tags || []).join(", ");
    document.getElementById("categories").value = (post.Categories || []).join(
      ", "
    );
    document.getElementById("slugPreview").textContent = `/post/${post.Slug}`;
    if (!easyMDE) {
      easyMDE = new EasyMDE({
        element: document.getElementById("content"),
        spellChecker: false,
        placeholder: "Write your post content here...",
        autosave: {
          enabled: true,
          uniqueId: "modifyPostContent",
          delay: 1000,
        },
      });
    }
    postSlug = post.Slug;
    console.log("Date ", post.PublishedDate);
    easyMDE.value(post.Body || "");
    // Inject schedule group only for unpublished posts
    const form = document.getElementById("modifyPostForm");

    // Inject only for unpublished posts
    console.log("Post is published: ", post.IsPublished || post.isPublished);
    if (!(post.IsPublished || post.isPublished)) {
      const scheduleGroupHTML = `
        <div class="form-group" id="scheduleGroupContainer">
          <div class="schedule-group">
            <!-- Using an explicit label for better rendering reliability -->
            <div style="display: flex; align-items: center; gap: 8px;">
              <input type="checkbox" id="schedulePost" name="schedulePost" style="margin: 0; width: auto; flex-shrink: 0;"/>
              <label for="schedulePost" class="checkbox-label" style="margin: 0;">Schedule this post for later</label>
            </div>
            <div
              id="scheduleInput"
              class="schedule-input"
              style="display: none"
            >
              <label for="scheduledDate">Publish Date & Time:</label>
              <input
                type="datetime-local"
                id="scheduledDate"
                name="scheduledDate"
              />
            </div>
          </div>
        </div>
      `;
      // Insert before form actions
      const actions = document.querySelector(".form-actions");
      if (actions) {
        actions.insertAdjacentHTML("beforebegin", scheduleGroupHTML);
      }
      // Setup checkbox and input
      const scheduleCheckbox = document.getElementById("schedulePost");
      const scheduleInput = document.getElementById("scheduleInput");
      if (post.ScheduledDate) {
        if (scheduleCheckbox) scheduleCheckbox.checked = true;
        if (scheduleInput) scheduleInput.style.display = "block";
        let dt = post.ScheduledDate;
        let localValue = "";
        if (dt) {
          const dateObj = new Date(dt);
          if (!isNaN(dateObj.getTime())) {
            localValue =
              dateObj.getFullYear() +
              "-" +
              String(dateObj.getMonth() + 1).padStart(2, "0") +
              "-" +
              String(dateObj.getDate()).padStart(2, "0") +
              "T" +
              String(dateObj.getHours()).padStart(2, "0") +
              ":" +
              String(dateObj.getMinutes()).padStart(2, "0");
          }
        }
        if (document.getElementById("scheduledDate")) {
          document.getElementById("scheduledDate").value = localValue;
        }
      } else {
        if (scheduleInput) scheduleInput.style.display = "none";
        if (scheduleCheckbox) scheduleCheckbox.checked = false;
      }
      // Add event listener for checkbox to toggle input
      if (scheduleCheckbox && scheduleInput) {
        scheduleCheckbox.addEventListener("change", function () {
          scheduleInput.style.display = this.checked ? "block" : "none";
        });
      }
    }
    // Always initialize imagesToKeep from the post's images (handle both Images and images)
    postImages = post.Images || post.images || [];
    imagesToKeep = [...postImages];
    // Listen for changes to enable update button
    ["title", "description", "customUrl", "tags", "categories"].forEach(
      (id) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("input", enableUpdateButton);
      }
    );
    easyMDE.codemirror.on("change", enableUpdateButton);

    initializeThemeToggle();
    initMobileSidebar();
    if (post.PublishedDate) {
      const parsedDate = new Date(post.PublishedDate);
      if (!isNaN(parsedDate.getTime())) {
        dateOnly = parsedDate.toISOString().split("T")[0];
      } else {
        dateOnly = "";
      }
    } else {
      dateOnly = "";
    }
    renderUnifiedPreview();
  } else {
    showMessage("No post data available to load", "warning");
  }
});

// Update preview when custom URL input changes
const customUrlInput = document.getElementById("customUrl");
const slugPreviewElem = document.getElementById("slugPreview");
if (customUrlInput && slugPreviewElem) {
  customUrlInput.addEventListener("input", () => {
    const newSlug = customUrlInput.value.trim() || postSlug;
    slugPreviewElem.textContent = `/post/${newSlug}`;
  });
}

async function submitModification() {
  const formData = new FormData();
  const slug = document.getElementById("customUrl").value;

  // Get form values manually to ensure correct naming
  const title = document.getElementById("title").value.trim();
  const description = document.getElementById("description").value.trim();
  const body = easyMDE.value().trim();
  const tags = document.getElementById("tags").value.trim();
  const categories = document.getElementById("categories").value.trim();

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

  // Determine final slug: use custom input if provided, otherwise keep existing
  const slugValue = slug.trim();
  const finalSlug = slugValue || postSlug;
  // Prevent default 'untitled' slug collisions
  if (finalSlug.toLowerCase().startsWith("untitled")) {
    showMessage(
      "Invalid custom URL: please specify a non-default slug.",
      "warning"
    );
    return;
  }
  // Add all fields to formData
  formData.append("Title", title);
  formData.append("Description", description);
  formData.append("Body", body);
  formData.append("Tags", tags);
  formData.append("Categories", categories);
  formData.append("CustomUrl", slug);
  // Only set IsPublished to true if the post is already published
  const raw = sessionStorage.getItem("postData");
  let post = {};
  if (raw) {
    post = JSON.parse(raw);
  }
  const isPublished = post.IsPublished || post.isPublished;
  if (isPublished) {
    formData.append("IsPublished", "true");
  }
  if (post.PublishedDate) {
    formData.append("PublishedDate", post.PublishedDate);
  }

  // If the post is a draft, handle scheduling options
  if (!isPublished) {
    const scheduleCheckbox = document.getElementById("schedulePost");
    const scheduledDateInput = document.getElementById("scheduledDate");

    if (
      scheduleCheckbox &&
      scheduleCheckbox.checked &&
      scheduledDateInput &&
      scheduledDateInput.value
    ) {
      // If scheduling is checked and a valid date is provided, send it
      const localDate = new Date(scheduledDateInput.value);
      if (!isNaN(localDate.getTime())) {
        formData.append("ScheduledDate", localDate.toISOString());
      } else {
        // If the date is invalid, clear any existing schedule on the backend
        formData.append("ScheduledDate", post.ScheduledDate || "");
      }
    } else {
      // If scheduling is unchecked or no date is provided, clear any existing schedule
      formData.append("ScheduledDate", post.ScheduledDate || "");
    }
  }
  // Always add kept images (images that weren't removed or unchanged)
  if (imagesToKeep && imagesToKeep.length > 0) {
    imagesToKeep.forEach((imagePath) => {
      formData.append("KeptImages", imagePath);
    });
  }

  // Add any new images from file input
  const imageFiles = document.getElementById("images").files;
  if (imageFiles.length > 0) {
    for (let i = 0; i < imageFiles.length; i++) {
      formData.append("Images", imageFiles[i]);
    }
  }

  try {
    showMessage("Updating post...", "info");

    const response = await authenticatedFetch(`/api/posts/modify/${postSlug}`, {
      method: "PUT",
      body: formData,
    });

    const result = await response.json();
    showMessage("Post updated successfully!", "success");
    setTimeout(() => {
      window.location.href = "/blog";
    }, 1200);
  } catch (error) {
    if (error instanceof HttpError) {
      if (error.message === "Session expired") {
        // Message and redirect are handled by authenticatedFetch
        return; // Stop further execution
      }
      // Handle other HTTP errors
      const errorText = await error.response.text();
      console.error("Server response:", errorText);
      try {
        const errorJson = JSON.parse(errorText);
        showMessage(
          "Error: " + (errorJson.message || errorJson.title || "Unknown error"),
          "error"
        );
      } catch {
        showMessage(`Error updating post: ${errorText}`, "error");
      }
    } else {
      console.error("Network error:", error);
      showMessage("Network error occurred while updating the post", "error");
    }
  }
}

addEventListener("submit", (e) => {
  e.preventDefault();
  submitModification();
});

const cancelBtn = document.getElementById("cancelBtn");
if (cancelBtn) {
  cancelBtn.addEventListener("click", () => {
    const username = localStorage.getItem("username");
    if (!username) {
      showMessage("You must be logged in to cancel modifications", "warning");
      return;
    }
    window.location.href = `/profile/${username}`;
  });
}
