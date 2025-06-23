let currentPage = 1;
const pageSize = 5;

window.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("jwtToken");
  const username = new URLSearchParams(window.location.search).get("username");

  if (!token)
    return (window.location.href = "http://localhost:5000/api/auth/login");

  if (username) {
    const usernameSpan = document.getElementById("username");
    if (usernameSpan) usernameSpan.textContent = username;
  }

  loadPosts();

  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    localStorage.removeItem("jwtToken");
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
    const createdAt = new Date(post.PublishedDate).toLocaleDateString();
    const updatedAt = post.LastModified
      ? new Date(post.LastModified).toLocaleDateString()
      : "";
    const tags = post.Tags.join(", ") || "No tags";
    const categories = post.Categories.join(", ") || "No categories";
    const scheduledDate = post.ScheduledDate
      ? new Date(post.ScheduledDate).toLocaleString()
      : "";

    postCard.innerHTML = `
      <h3>${title}</h3>
      <p>${description}</p>
      <div class="post-body">${body}</div>
      <small>By ${author} • Created: ${createdAt} ${
      updatedAt ? `• Modified: ${updatedAt}` : ""
    }</small><br>
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
    const tags = form.tags.value
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag);
    const categories = form.categories.value
      .split(",")
      .map((cat) => cat.trim())
      .filter((cat) => cat);
    const scheduledDate = form.scheduledDate.value
      ? new Date(form.scheduledDate.value).toISOString()
      : null;

    const postData = {
      Title: form.title.value,
      Description: form.description.value,
      Body: form.body.value,
      CustomUrl: form.customUrl.value,
      Tags: tags,
      Categories: categories,
      IsPublished: true,
      ScheduledDate: scheduledDate,
    };

    try {
      const res = await fetch("http://localhost:5000/api/posts/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(postData),
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
  const tags = form.tags.value
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag);
  const categories = form.categories.value
    .split(",")
    .map((cat) => cat.trim())
    .filter((cat) => cat);
  const scheduledDate = form.scheduledDate.value
    ? new Date(form.scheduledDate.value).toISOString()
    : null;

  const postData = {
    Title: form.title.value,
    Description: form.description.value,
    Body: form.body.value,
    CustomUrl: form.customUrl.value,
    Tags: tags,
    Categories: categories,
    IsPublished: false, // Draft
    ScheduledDate: scheduledDate,
  };

  try {
    const res = await fetch("http://localhost:5000/api/posts/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(postData),
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

    const postData = {
      Title: form.modifyTitle.value,
      Description: form.modifyDescription.value,
      Body: form.modifyBody.value,
      CustomUrl: form.modifyCustomUrl.value,
      Tags: form.modifyTags.value.split(",").map((tag) => tag.trim()),
      Categories: form.modifyCategories.value
        .split(",")
        .map((cat) => cat.trim()),
      ScheduledDate: form.modifyScheduledDate.value
        ? new Date(form.modifyScheduledDate.value).toISOString()
        : null,
    };

    try {
      const res = await fetch(
        `http://localhost:5000/api/posts/modify/${slug}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(postData),
        }
      );

      if (!res.ok)
        throw new Error(`Server responded with status ${res.status}`);

      if (res.status === 200) {
        showMessageBanner("Post modified successfully!", "success");
        loadPosts();
      }

      document.getElementById("modifyPostModal")?.classList.add("hidden");
    } catch (err) {
      console.error("Error modifying post:", err);
      showMessageBanner("Failed to modify post. Please try again.", "error");
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
