import { showMessage, showConfirmation } from "./utils/notifications.js";
import { initializeThemeToggle } from "./utils/themeToggle.js";

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
  const raw = sessionStorage.getItem("postData");
  token = localStorage.getItem("jwtToken");
  username = localStorage.getItem("username");
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
    if (post.scheduledDate) {
      document.getElementById("schedulePost").checked = true;
      document.getElementById("scheduleInput").style.display = "block";
      document.getElementById("scheduledDate").value = post.ScheduledDate.slice(
        0,
        16
      );
    }
    postImages = post.Images || [];
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
    showImages();
    if (post.images?.length) {
      const previewContainer = document.getElementById("imagePreview");
      previewContainer.innerHTML = "";
      post.images.forEach((img) => {
        const imgEl = document.createElement("img");
        imgEl.src = `https://localhost:7189/Content/posts/${dateOnly}-${postSlug}${img}`;
        imgEl.alt = "Post image";
        imgEl.classList.add("preview-thumb");
        previewContainer.appendChild(imgEl);
      });

      imagesToKeep = [...post.images];
    }
  } else {
    showMessage("No post data available to load", "warning");
  }
});

async function submitModification() {
  const form = document.getElementById("modifyPostForm");
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
  const imageFiles = document.getElementById("images").files;
  if (imageFiles.length > 0) {
    for (let i = 0; i < imageFiles.length; i++) {
      formData.append("Images", imageFiles[i]);
    }
  }

  try {
    showMessage("Updating post...", "info");

    const response = await fetch(
      `https://localhost:7189/api/posts/modify/${postSlug}`,
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
      setTimeout(() => {
        window.location.href = "/blog";
      }, 1200);
    } else {
      const errorText = await response.text();
      console.error("Server response:", errorText);

      try {
        const errorJson = JSON.parse(errorText);
        showMessage(
          "Error: " + (errorJson.message || errorJson.title || "Unknown error"),
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

addEventListener("submit", (e) => {
  e.preventDefault();
  submitModification();
});

function showImages() {
  const previewContainer = document.getElementById("imagePreview");
  previewContainer.innerHTML = "";
  imagesToKeep.forEach((img) => {
    const wrapper = document.createElement("div");
    wrapper.className = "image-thumb-wrapper";
    const imgEl = document.createElement("img");
    imgEl.src = `https://localhost:7189/Content/posts/${dateOnly}-${postSlug}${img}`;
    imgEl.alt = "Post image";
    imgEl.classList.add("preview-thumb");
    const removeBtn = document.createElement("button");
    removeBtn.className = "remove-image-btn btn"; // Add .btn class here
    removeBtn.type = "button";
    removeBtn.innerHTML = "✖";
    removeBtn.title = "Remove this image";
    removeBtn.onclick = () => {
      imagesToKeep = imagesToKeep.filter((i) => i !== img);
      showImages();
      enableUpdateButton();
    };
    wrapper.appendChild(imgEl);
    wrapper.appendChild(removeBtn);
    previewContainer.appendChild(wrapper);
  });
}

const cancelBtn = document.getElementById("cancelBtn");
if (cancelBtn) {
  cancelBtn.addEventListener("click", () => {
    const username =
      document.getElementById("username")?.textContent || "Guest";
    window.location.href = `/profile/${username}`;
  });
}
