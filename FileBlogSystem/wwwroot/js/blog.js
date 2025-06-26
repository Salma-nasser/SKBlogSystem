let currentPage = 1;
const pageSize = 5;

window.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("jwtToken");
  const username = localStorage.getItem("username");

  if (!token)
    return (window.location.href = "http://localhost:5000/api/auth/login");

  if (username) {
    const usernameSpan = document.getElementById("username");
    if (usernameSpan) usernameSpan.textContent = username;
  }

  loadPosts();

  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    localStorage.removeItem("jwtToken");
    localStorage.removeItem("username");
    window.location.href = "login.html";
  });

  document.getElementById("searchInput")?.addEventListener("input", () => {
    currentPage = 1;
    loadPosts();
  });

  document.getElementById("prevPage")?.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      loadPosts();
    }
  });

  document.getElementById("nextPage")?.addEventListener("click", () => {
    currentPage++;
    loadPosts();
  });
});

function loadPosts() {
  const token = localStorage.getItem("jwtToken");
  const searchQuery =
    document.getElementById("searchInput")?.value.trim().toLowerCase() || "";

  fetch("http://localhost:5000/api/posts", {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((res) => res.json())
    .then((posts) => {
      const filtered = posts.filter((post) => {
        const now = new Date();
        const scheduledDate = post.ScheduledDate
          ? new Date(post.ScheduledDate)
          : null;

        const matchesSearch =
          post.Title.toLowerCase().includes(searchQuery) ||
          post.Description.toLowerCase().includes(searchQuery) ||
          post.Tags.some((tag) => tag.toLowerCase().includes(searchQuery)) ||
          post.Categories.some((cat) =>
            cat.toLowerCase().includes(searchQuery)
          );

        return (
          post.IsPublished &&
          (!scheduledDate || scheduledDate <= now) &&
          matchesSearch
        );
      });

      renderPosts(paginate(filtered, currentPage, pageSize));
      updatePagination(filtered.length);
    })
    .catch((err) => console.error("Failed to fetch posts:", err));
}

function paginate(items, page, size) {
  const start = (page - 1) * size;
  return items.slice(start, start + size);
}

function updatePagination(totalItems) {
  const totalPages = Math.max(Math.ceil(totalItems / pageSize), 1);
  document.getElementById(
    "pageInfo"
  ).textContent = `Page ${currentPage} of ${totalPages}`;
}

function renderPosts(posts) {
  const postsContainer = document.getElementById("postsContainer");
  postsContainer.innerHTML = "";

  posts.forEach((post) => {
    const postCard = document.createElement("div");
    postCard.className = "post-card";
    postCard.dataset.slug = post.Slug;

    const title = post.Title || "Untitled";
    const description = post.Description || "No description provided.";
    const body = post.Body || "No content available.";
    const author = post.Author || "Anonymous";

    // Show date and time
    const createdAt = new Date(post.PublishedDate).toLocaleString();

    // Only show "Modified" if LastModified is DIFFERENT from PublishedDate
    let updatedAt = "";
    if (post.LastModified && post.LastModified !== post.PublishedDate) {
      updatedAt = new Date(post.LastModified).toLocaleString();
    }

    const tags = post.Tags.join(", ") || "No tags";
    const categories = post.Categories.join(", ") || "No categories";
    const scheduledDate = post.ScheduledDate
      ? new Date(post.ScheduledDate).toLocaleString()
      : "";

    // Render images if available
    let imageHtml = "";
    const dateOnly = new Date(post.PublishedDate).toISOString().split("T")[0];

    if (post.Images && post.Images.length > 0) {
      imageHtml = post.Images.map(
        (imgUrl) =>
          `<img src="http://localhost:5000/Content/posts/${dateOnly}-${post.Slug}${imgUrl}" alt="Post Image" class="post-image"/>`
      ).join("");
    }

    postCard.innerHTML = `
      <h3>${title}</h3>
      <p>${description}</p>
      <div class="post-body">${body}</div>
      ${imageHtml}
      <small>By ${author} • Created: ${createdAt}</small><br>
      ${updatedAt ? `<small>Modified: ${updatedAt}</small><br>` : ""}
      <small>Tags: ${tags} • Categories: ${categories}</small><br>
      ${
        scheduledDate
          ? `<small>Scheduled for: ${scheduledDate}</small><br>`
          : ""
      }
      <button class="modifyBtn">Modify</button>
    `;

    postsContainer.appendChild(postCard);
  });
}

document.getElementById("newPostBtn")?.addEventListener("click", () => {
  document.getElementById("postModal")?.classList.remove("hidden");
});

document.getElementById("closeModal")?.addEventListener("click", () => {
  document.getElementById("postModal")?.classList.add("hidden");
});

document
  .getElementById("createPostForm")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("jwtToken");
    if (!token) return alert("You must be logged in to publish a post.");

    const form = e.target;
    const formData = new FormData();

    // Add text fields to FormData
    formData.append("Title", form.title.value);
    formData.append("Description", form.description.value);
    formData.append("Body", form.body.value);
    formData.append("CustomUrl", form.customUrl.value);
    formData.append("IsPublished", "true");

    // Add tags and categories
    const tags = form.tags.value
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag);

    const categories = form.categories.value
      .split(",")
      .map((cat) => cat.trim())
      .filter((cat) => cat);

    // Add each tag and category as separate form values
    tags.forEach((tag) => formData.append("Tags", tag));
    categories.forEach((category) => formData.append("Categories", category));

    // Add scheduled date if available
    if (form.scheduledDate.value) {
      formData.append(
        "ScheduledDate",
        new Date(form.scheduledDate.value).toISOString()
      );
    }

    // Add image files if available
    const imageInput = form.querySelector('input[type="file"]');
    if (imageInput && imageInput.files.length > 0) {
      for (let i = 0; i < imageInput.files.length; i++) {
        formData.append("Images", imageInput.files[i]);
      }
    }

    try {
      const res = await fetch("http://localhost:5000/api/posts/create", {
        method: "POST",
        headers: {
          // Don't set Content-Type here - FormData will set it automatically with boundary
          Authorization: `Bearer ${token}`,
        },
        body: formData, // Use FormData instead of JSON.stringify
      });

      if (!res.ok)
        throw new Error(`Server responded with status ${res.status}`);

      if (res.status === 201) {
        showMessageBanner("Post published successfully!", "success");
        loadPosts();
      }

      document.getElementById("postModal")?.classList.add("hidden");
    } catch (err) {
      console.error("Error creating post:", err);
      showMessageBanner("Failed to publish post. Please try again.", "error");
    }
  });

document.getElementById("saveDraftBtn")?.addEventListener("click", async () => {
  const token = localStorage.getItem("jwtToken");
  if (!token) return alert("You must be logged in to save a draft.");

  const form = document.getElementById("createPostForm");
  const formData = new FormData();

  // Add text fields to FormData
  formData.append("Title", form.title.value);
  formData.append("Description", form.description.value);
  formData.append("Body", form.body.value);
  formData.append("CustomUrl", form.customUrl.value);
  formData.append("IsPublished", "false"); // Draft

  // Add tags and categories
  const tags = form.tags.value
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag);

  const categories = form.categories.value
    .split(",")
    .map((cat) => cat.trim())
    .filter((cat) => cat);

  tags.forEach((tag) => formData.append("Tags", tag));
  categories.forEach((category) => formData.append("Categories", category));

  // Add scheduled date if available
  if (form.scheduledDate.value) {
    formData.append(
      "ScheduledDate",
      new Date(form.scheduledDate.value).toISOString()
    );
  }

  // Add image files
  const imageInput = form.querySelector('input[type="file"]');
  if (imageInput && imageInput.files.length > 0) {
    for (let i = 0; i < imageInput.files.length; i++) {
      formData.append("Images", imageInput.files[i]);
    }
  }

  try {
    const res = await fetch("http://localhost:5000/api/posts/create", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!res.ok) throw new Error(`Server responded with status ${res.status}`);

    if (res.status === 201) {
      showMessageBanner("Draft saved successfully!", "success");
      loadPosts();
    }

    document.getElementById("postModal")?.classList.add("hidden");
  } catch (err) {
    console.error("Error saving draft:", err);
    showMessageBanner("Failed to save draft. Please try again.", "error");
  }
});

document.addEventListener("click", (e) => {
  if (e.target.classList.contains("modifyBtn")) {
    const postCard = e.target.closest(".post-card");
    if (!postCard) return;

    const title = postCard.querySelector("h3").textContent;
    const description = postCard.querySelector("p").textContent;
    const body = postCard.querySelector(".post-body").textContent;
    const slug = postCard.dataset.slug;

    document.getElementById("modifyTitle").value = title;
    document.getElementById("modifyDescription").value = description;
    document.getElementById("modifyBody").value = body;
    document.getElementById("postSlug").value = slug;

    document.getElementById("modifyPostModal")?.classList.remove("hidden");
  }
});

document
  .getElementById("modifyPostForm")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("jwtToken");
    if (!token) return alert("You must be logged in to modify a post.");

    const form = e.target;
    const slug = form.postSlug.value;

    const formData = new FormData();
    formData.append("Title", form.modifyTitle.value);
    formData.append("Description", form.modifyDescription.value);
    formData.append("Body", form.modifyBody.value);
    formData.append("CustomUrl", form.modifyCustomUrl.value);
    formData.append("Tags", form.modifyTags.value);
    formData.append("Categories", form.modifyCategories.value);

    const imageInput = document.getElementById("modifyImages");
    for (let i = 0; i < imageInput.files.length; i++) {
      formData.append("Images", imageInput.files[i]);
    }

    try {
      const res = await fetch(
        `http://localhost:5000/api/posts/blog-modify/${slug}`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      );

      if (!res.ok)
        throw new Error(`Server responded with status ${res.status}`);

      alert("Post modified successfully!");
      form.reset();
      loadPosts(); // Reload the blog posts (you should have this method in your blog.js)
      document.getElementById("modifyPostModal")?.classList.add("hidden");
    } catch (err) {
      console.error("Error modifying post:", err);
      alert("Failed to modify post. Please try again.");
    }
  });

document.getElementById("closeModifyModal")?.addEventListener("click", () => {
  document.getElementById("modifyPostModal")?.classList.add("hidden");
});

function showMessageBanner(text, type = "success") {
  const banner = document.getElementById("messageBanner");
  if (!banner) return;
  banner.textContent = text;
  banner.className = type === "error" ? "error" : "success";
  banner.classList.remove("hidden");

  setTimeout(() => {
    banner.classList.add("hidden");
  }, 3000);
}
document.getElementById("profileBtn")?.addEventListener("click", () => {
  window.location.href = "profile.html";
});

const modeToggle = document.getElementById("modeToggle");
let isDarkMode = false;

modeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
  isDarkMode = !isDarkMode;

  if (isDarkMode) {
    modeToggle.setAttribute("data-theme", "dark");
    modeToggle.textContent = "🌙";
  } else {
    modeToggle.setAttribute("data-theme", "light");
    modeToggle.textContent = "☀️";
  }
});
