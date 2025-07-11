import { showMessage } from "./notifications.js";

export function renderPosts(posts, containerId, options = {}) {
  const {
    showDelete = false,
    showModify = false,
    showAuthor = true,
    showActions = true,
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

    // Build author display
    let authorHtml;
    if (showAuthor) {
      const currentUsername = localStorage.getItem("username");
      const authorUrl =
        post.Author === currentUsername
          ? "my-profile"
          : `my-profile?username=${post.Author}`;
      authorHtml = `<small>By <a href="${authorUrl}" class="author-link">${
        post.Author
      }</a> • ${new Date(post.PublishedDate).toLocaleString()}</small>`;
    } else {
      authorHtml = `<small>${new Date(
        post.PublishedDate
      ).toLocaleString()}</small>`;
    }

    // Build action buttons conditionally
    let actionsHtml = "";
    if (showActions) {
      const buttons = [];

      if (showModify) {
        // Encode the post data as base64 to avoid JSON parsing issues
        const encodedPost = btoa(JSON.stringify(post));
        buttons.push(
          `<button class="modifyBtn" data-slug="${post.Slug}" data-post-encoded="${encodedPost}">Modify</button>`
        );
      }

      if (showDelete) {
        buttons.push(
          `<button class="deleteBtn" data-slug="${post.Slug}">Delete</button>`
        );
      }

      actionsHtml = buttons.join("");
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
      <p class="post-description">${post.Description}</p>

      ${post.Body ? `<div class="post-body">${post.Body}</div>` : ""}
      
      ${imgHtml}
      ${authorHtml}
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
      btn.addEventListener("click", () => {
        const slug = btn.dataset.slug;
        const post = posts.find((p) => p.Slug === slug);
        if (post) {
          onModify(post);
        }
      });
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

        // In the like-count click event listener, replace the modal creation section:

        const modal = document.createElement("div");
        modal.className = "like-modal";
        modal.style.cssText = `
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

        modal.innerHTML = `
  <div class="like-list" style="
    background: var(--post-bg, #fff);
    color: var(--text-color, #333);
    padding: 30px;
    border-radius: 12px;
    max-width: 500px;
    width: 90vw;
    max-height: 70vh;
    overflow-y: auto;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
  ">
    <h3 style="
      margin: 0 0 20px 0;
      font-size: 1.5rem;
      color: var(--text-color, #333);
      border-bottom: 2px solid var(--accent-color, #c89b7b);
      padding-bottom: 10px;
    ">Liked by ${likers.length} ${
          likers.length === 1 ? "person" : "people"
        }</h3>
    <ul style="
      list-style: none;
      padding: 0;
      margin: 0 0 20px 0;
    ">
      ${
        likers.length > 0
          ? likers
              .map(
                (user) => `
          <li style="
            display: flex;
            align-items: center;
            margin-bottom: 15px;
            padding: 10px;
            border-radius: 8px;
            background: var(--card-background, #f9f9f9);
            transition: background-color 0.2s ease;
          " onmouseover="this.style.background='var(--accent-color, #c89b7b)'; this.style.opacity='0.8';" 
            onmouseout="this.style.background='var(--card-background, #f9f9f9)'; this.style.opacity='1';">
            <div style="
              width: 50px;
              height: 50px;
              border-radius: 50%;
              margin-right: 15px;
              overflow: hidden;
              background: var(--accent-color, #c89b7b);
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
            ">
              ${
                user.profilePictureUrl && user.profilePictureUrl !== ""
                  ? `<img src="${user.profilePictureUrl}" alt="${
                      user.username
                    }" 
                      style="width: 100%; height: 100%; object-fit: cover;"
                      onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                  <div style="
                    display: none;
                    width: 100%;
                    height: 100%;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: bold;
                    font-size: 1.2rem;
                  ">${user.username.charAt(0).toUpperCase()}</div>`
                  : `<div style="
                    display: flex;
                    width: 100%;
                    height: 100%;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: bold;
                    font-size: 1.2rem;
                  ">${user.username.charAt(0).toUpperCase()}</div>`
              }
            </div>
            <div style="flex: 1;">
              <div style="
                font-weight: 600;
                font-size: 1.1rem;
                color: var(--text-color, #333);
                margin-bottom: 2px;
              ">${user.username}</div>
              ${
                user.displayName && user.displayName !== user.username
                  ? `<div style="
                    font-size: 0.9rem;
                    color: var(--text-muted, #666);
                  ">${user.displayName}</div>`
                  : ""
              }
            </div>
            <a href="my-profile?username=${user.username}" style="
              padding: 5px 12px;
              background: var(--accent-color, #c89b7b);
              color: white;
              text-decoration: none;
              border-radius: 6px;
              font-size: 0.85rem;
              transition: background-color 0.2s ease;
            " onmouseover="this.style.background='var(--accent-hover, #a6765b)';"
              onmouseout="this.style.background='var(--accent-color, #c89b7b)';">
              View Profile
            </a>
          </li>
        `
              )
              .join("")
          : `<li style="
              text-align: center;
              padding: 40px;
              color: var(--text-muted, #666);
              font-style: italic;
            ">
              <div style="font-size: 3rem; margin-bottom: 10px;">💔</div>
              No likes yet. Be the first to like this post!
            </li>`
      }
    </ul>
    <div style="display: flex; gap: 10px; justify-content: flex-end;">
      <button class="close-modal" style="
        padding: 12px 24px;
        background: var(--button-bg, #8c6e63);
        color: var(--button-text, white);
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 1rem;
        font-weight: 500;
        transition: all 0.2s ease;
      " onmouseover="this.style.background='var(--accent-hover, #a6765b)'; this.style.transform='translateY(-1px)';"
        onmouseout="this.style.background='var(--button-bg, #8c6e63)'; this.style.transform='translateY(0)';">
        Close
      </button>
    </div>
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
        showMessage("Failed to load likes. Please try again.", "error");
      }
    });
  });
}
