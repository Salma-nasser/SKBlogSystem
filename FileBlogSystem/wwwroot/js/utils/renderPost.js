export function renderPosts(posts, containerId, options = {}) {
  const {
    showDelete = false,
    showModify = false,
    onDelete = null,
    onModify = null,
  } = options;

  const postsContainer = document.getElementById(containerId);
  if (!postsContainer) return;

  postsContainer.innerHTML = "";

  posts.forEach((post) => {
    const card = document.createElement("div");
    card.className = "post-card";
    card.dataset.slug = post.Slug;

    const tagsHtml = post.Tags.map(
      (tag) =>
        `<span class="tag clickable-tag" data-type="tag" data-value="${tag}">${tag}</span>`
    ).join("");

    const catsHtml = post.Categories.map(
      (cat) =>
        `<span class="category clickable-tag" data-type="category" data-value="${cat}">${cat}</span>`
    ).join("");

    let imgHtml = "";
    if (post.Images?.length) {
      const dateOnly = new Date(post.PublishedDate).toISOString().split("T")[0];
      imgHtml = `
        <div class="post-images post-images-${post.Images.length}">
          ${post.Images.map(
            (image) => `
            <img src="https://localhost:7189/Content/posts/${dateOnly}-${post.Slug}${image}"
                alt="Post Image"
                class="post-image" />
          `
          ).join("")}
        </div>
      `;
    }

    // Build action buttons conditionally
    let actionsHtml = "";
    if (showDelete) {
      actionsHtml += `<button class="delete-btn" data-slug="${post.Slug}">Delete</button>`;
    }
    if (showModify) {
      actionsHtml += `<button class="modify-btn" data-slug="${post.Slug}">Modify</button>`;
    }

    card.innerHTML = `
      <h3><a href="post.html?slug=${post.Slug}">${post.Title}</a></h3>
      <p>${post.Description}</p>
      ${imgHtml}
      <small>By ${post.Author} • ${new Date(
      post.PublishedDate
    ).toLocaleString()}</small>
      <div class="meta-info">
        <div><strong>Tags:</strong> ${tagsHtml || "—"}</div>
        <div><strong>Categories:</strong> ${catsHtml || "—"}</div>
      </div>
      <div class="post-actions">${actionsHtml}</div>
    `;

    postsContainer.appendChild(card);
  });

  // Add event listeners for delete/modify if needed
  if (showDelete && typeof onDelete === "function") {
    postsContainer.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", () => onDelete(btn.dataset.slug));
    });
  }

  if (showModify && typeof onModify === "function") {
    postsContainer.querySelectorAll(".modify-btn").forEach((btn) => {
      btn.addEventListener("click", () => onModify(btn.dataset.slug));
    });
  }
}
