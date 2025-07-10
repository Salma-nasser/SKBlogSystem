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
    const likeIcon = post.LikedByCurrentUser ? "❤️" : "🤍";
    const likeCount = post.Likes?.length || 0;
    const commentCount = post.CommentCount || 0;

    const interactionBarHtml = `
      <div class="interaction-bar">
        <span class="like-toggle" data-slug="${post.Slug}" data-liked="${post.LikedByCurrentUser}">
          ${likeIcon}
        </span>
        <span class="like-count" data-slug="${post.Slug}">${likeCount} Likes</span>
        <span class="comment-count" data-slug="${post.Slug}">${commentCount} Comments</span>
      </div>
    `;

    card.innerHTML = `
      <h3><a href="post?slug=${post.Slug}">${post.Title}</a></h3>
      <p>${post.Description}</p>
      ${imgHtml}
      <small>By ${post.Author} • ${new Date(
      post.PublishedDate
    ).toLocaleString()}</small>
      <div class="meta-info">
        <div><strong>Tags:</strong> ${tagsHtml || "—"}</div>
        <div><strong>Categories:</strong> ${catsHtml || "—"}</div>
      </div>
      ${interactionBarHtml}
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
  postsContainer.querySelectorAll(".like-toggle").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const slug = btn.dataset.slug;
      const liked = btn.dataset.liked === "true";

      try {
        // Toggle visual immediately for better UX
        btn.textContent = liked ? "🤍" : "❤️";
        btn.dataset.liked = (!liked).toString();

        const response = await fetch(
          `https://localhost:7189/api/posts/${slug}/like`,
          {
            method: liked ? "DELETE" : "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("jwtToken")}`,
            },
          }
        );

        if (!response.ok) {
          // Revert visual change if request failed
          btn.textContent = liked ? "❤️" : "🤍";
          btn.dataset.liked = liked.toString();
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        // Update like count
        const likeCountSpan = postsContainer.querySelector(
          `.like-count[data-slug="${slug}"]`
        );
        if (likeCountSpan) {
          likeCountSpan.textContent = `${result.likeCount} Likes`;
        }
      } catch (error) {
        console.error("Error toggling like:", error);
        // Revert visual change on error
        btn.textContent = liked ? "❤️" : "🤍";
        btn.dataset.liked = liked.toString();
      }
    });
  });

  // Show list of users who liked the post
  postsContainer.querySelectorAll(".like-count").forEach((countSpan) => {
    countSpan.addEventListener("click", async () => {
      const slug = countSpan.dataset.slug;

      try {
        const response = await fetch(
          `https://localhost:7189/api/posts/${slug}/likes`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("jwtToken")}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const likers = await response.json();

        const modal = document.createElement("div");
        modal.className = "like-modal";
        modal.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0,0,0,0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        `;

        modal.innerHTML = `
          <div class="like-list" style="
            background: white;
            padding: 20px;
            border-radius: 8px;
            max-width: 400px;
            max-height: 500px;
            overflow-y: auto;
          ">
            <h4>Liked by</h4>
            <ul style="list-style: none; padding: 0;">
              ${
                likers.length > 0
                  ? likers
                      .map(
                        (user) => `
                <li style="display: flex; align-items: center; margin-bottom: 10px;">
                  <img src="${user.profilePictureUrl}" alt="${user.username}" 
                       style="width: 32px; height: 32px; border-radius: 50%; margin-right: 10px;" />
                  <span>${user.username}</span>
                </li>
              `
                      )
                      .join("")
                  : "<li>No likes yet</li>"
              }
            </ul>
            <button class="close-modal" style="
              margin-top: 10px;
              padding: 8px 16px;
              background: #007bff;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
            ">Close</button>
          </div>
        `;

        document.body.appendChild(modal);

        modal
          .querySelector(".close-modal")
          .addEventListener("click", () => modal.remove());
        modal.addEventListener("click", (e) => {
          if (e.target === modal) modal.remove();
        });
      } catch (error) {
        console.error("Error fetching likes:", error);
        alert("Failed to load likes. Please try again.");
      }
    });
  });
}
