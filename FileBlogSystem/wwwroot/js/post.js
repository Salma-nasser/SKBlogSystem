import { renderPosts } from "./utils/renderPost.js";
import { initializeImageModal, openImageModal } from "./utils/imageModal.js";
import { initializeThemeToggle } from "./utils/themeToggle.js";
import { initMobileSidebar } from "./utils/mobileSidebar.js";
import { showMessage } from "./utils/notifications.js";
import { authenticatedFetch } from "./utils/api.js";

// Helper to split camelCase and concatenated labels and capitalize each word
function formatLabel(str) {
  return str
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// Extract slug from URL path (e.g., /post/Palestine -> Palestine)
function getSlugFromPath() {
  const path = window.location.pathname;
  const match = path.match(/\/post\/([^\/]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

window.addEventListener("DOMContentLoaded", () => {
  // Initialize components
  initializeImageModal();
  initializeThemeToggle();
  initMobileSidebar();
  const logoutBtn1 = document.querySelector(
    'a[href="/logout"], .header-buttons .btn[href="/logout"]'
  );
  if (logoutBtn1) {
    logoutBtn1.addEventListener("click", function (e) {
      localStorage.removeItem("jwtToken");
      localStorage.removeItem("username");
    });
  }
  // Get the post slug from URL path
  const slug = getSlugFromPath();

  if (!slug) {
    showMessage("Post not found", "error");
    setTimeout(() => {
      window.location.href = "/blog";
    }, 2000);
    return;
  }

  // Load the post
  loadPost(slug);

  // Navigation event listeners
  const backToBlogBtn = document.getElementById("backToBlogBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  backToBlogBtn?.addEventListener("click", () => {
    window.location.href = "/blog";
  });

  logoutBtn?.addEventListener("click", () => {
    localStorage.removeItem("jwtToken");
    showMessage("Logged out successfully", "info");
    setTimeout(() => {
      window.location.href = "/login";
    }, 1000);
  });
});

async function loadPost(slug) {
  try {
    showMessage("Loading post...", "info");

    const response = await authenticatedFetch(`/api/posts/${slug}`);

    const post = await response.json();

    // Update page title
    document.title = `${post.Title} - Blog`;

    // Render the single post
    renderSinglePost(post);

    // Clear the loading message
    const messageContainer = document.querySelector(".message");
    if (messageContainer) {
      messageContainer.remove();
    }
  } catch (error) {
    if (error.message !== "Session expired") {
      console.error("Error loading post:", error);

      // Show error in the post container
      const container = document.getElementById("postContainer");
      if (container) {
        container.innerHTML = `
          <div class="error-container">
            <h2>Post Not Found</h2>
            <p>${error.message}</p>
            <button onclick="window.location.href='/blog'" class="btn btn-primary">
              Back to Blog
            </button>
          </div>
        `;
      }

      showMessage(error.message, "error");
    }
  }
}

function renderSinglePost(post) {
  const container = document.getElementById("postContainer");
  if (!container) return;

  const publishedDate = post.PublishedDate || post.CreatedDate;
  const formattedDate = publishedDate
    ? new Date(publishedDate).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "";

  const dateOnly = publishedDate
    ? new Date(publishedDate).toISOString().split("T")[0]
    : "";

  // Generate images HTML with proper layout classes
  let imagesHtml = "";
  if (post.Images && post.Images.length > 0) {
    const imageCount = post.Images.length;
    let layoutClass = "single-image";

    if (imageCount === 2) {
      layoutClass = "multiple-images images-2";
    } else if (imageCount === 3) {
      layoutClass = "multiple-images images-3";
    } else if (imageCount >= 4) {
      layoutClass = "multiple-images images-4-plus";
    }

    imagesHtml = `
      <div class="single-post-images ${layoutClass}">
        ${post.Images.map((imagePath, index) => {
          // If backend already sent secure/absolute URL, use it directly
          if (
            typeof imagePath === "string" &&
            (imagePath.startsWith("http://") ||
              imagePath.startsWith("https://") ||
              imagePath.startsWith("/api/posts/"))
          ) {
            return `
                <img 
                  src="${imagePath}" 
                  alt="Post Image ${index + 1}" 
                  class="post-image" 
                  loading="lazy"
                  data-index="${index}"
                  onerror="this.style.display='none'"
                />`;
          }

          // Fallback: legacy relative stored path -> map to secure endpoint by filename
          const str = String(imagePath || "");
          const parts = str.split("/");
          const fileName = parts[parts.length - 1];
          const secureUrl = `/api/posts/${post.Slug}/assets/${fileName}`;
          return `
              <img 
                src="${secureUrl}" 
                alt="Post Image ${index + 1}" 
                class="post-image" 
                loading="lazy"
                data-index="${index}"
                onerror="this.style.display='none'"
              />`;
        }).join("")}
      </div>
    `;
  }

  // Tags and categories
  const tagsHtml =
    post.Tags && post.Tags.length > 0
      ? `<div class="post-tags">
        <strong>Tags:</strong> ${post.Tags.map(
          (tag) => `<span class="tag">${formatLabel(tag)}</span>`
        ).join("")}
      </div>`
      : "";

  const categoriesHtml =
    post.Categories && post.Categories.length > 0
      ? `<div class="post-categories">
        <strong>Categories:</strong> ${post.Categories.map(
          (category) => `<span class="category">${formatLabel(category)}</span>`
        ).join("")}
      </div>`
      : "";

  // Interaction bar with likes and comments
  const likeIcon = post.LikedByCurrentUser ? "❤️" : "🤍";
  const likeCount = post.Likes?.length || 0;

  const interactionBarHtml = `
    <div class="interaction-bar">
      <span class="like-toggle" data-slug="${post.Slug}" data-liked="${post.LikedByCurrentUser}">
        ${likeIcon}
      </span>
      <span class="like-count" data-slug="${post.Slug}">${likeCount} Likes</span>
    </div>
  `;

  container.innerHTML = `
    <article class="single-post">
      <header class="post-header">
        <h1 class="post-title">${post.Title || "Untitled"}</h1>
        <div class="post-meta">
          <span class="post-author">By <strong>${
            post.Author || "Unknown Author"
          }</strong></span>
          <span class="post-date">${formattedDate}</span>
        </div>
      </header>
      
      <div class="post-description">
        ${post.Description || ""}
      </div>
      
      ${imagesHtml}
      
      <div class="post-content">
        ${renderMarkdownContent(post.Body || "")}
      </div>
      
      <div class="post-metadata">
        ${tagsHtml}
        ${categoriesHtml}
      </div>
      
      ${interactionBarHtml}
    </article>
  `;
  // Add event listeners for likes functionality
  setupLikesInteraction(post.Slug);
}

function renderMarkdownContent(markdownText) {
  if (!markdownText) return "";

  try {
    // Configure marked options for better security and features
    marked.setOptions({
      breaks: true,
      gfm: true,
      sanitize: false, // We'll handle image URLs manually
      smartLists: true,
      smartypants: true,
    });

    // Render the markdown to HTML
    const rawHtml = marked.parse(markdownText);
    return DOMPurify.sanitize(rawHtml);
  } catch (error) {
    console.error("Error rendering markdown:", error);
    // Fallback to plain text with line breaks
    return markdownText.replace(/\n/g, "<br>");
  }
}

function setupLikesInteraction(slug) {
  const container = document.getElementById("postContainer");

  // Like toggle functionality
  const likeToggle = container.querySelector(".like-toggle");
  if (likeToggle) {
    likeToggle.addEventListener("click", async () => {
      const liked = likeToggle.dataset.liked === "true";

      try {
        // Toggle visual immediately for better UX
        likeToggle.textContent = liked ? "🤍" : "❤️";
        likeToggle.dataset.liked = (!liked).toString();

        const response = await authenticatedFetch(`/api/posts/${slug}/like`, {
          method: liked ? "DELETE" : "POST",
        });

        const result = await response.json();

        // Update like count
        const likeCountSpan = container.querySelector(
          `.like-count[data-slug="${slug}"]`
        );
        if (likeCountSpan) {
          likeCountSpan.textContent = `${result.likeCount} Likes`;
        }

        showMessage(liked ? "Like removed" : "Post liked!", "success");
      } catch (error) {
        if (error.message !== "Session expired") {
          console.error("Error toggling like:", error);
          // Revert visual change on error
          likeToggle.textContent = liked ? "❤️" : "🤍";
          likeToggle.dataset.liked = liked.toString();
          showMessage("Failed to update like status", "error");
        }
      }
    });
  }

  // Show list of users who liked the post
  const likeCount = container.querySelector(".like-count");
  if (likeCount) {
    likeCount.addEventListener("click", async () => {
      try {
        const response = await authenticatedFetch(`/api/posts/${slug}/likes`);

        const likers = await response.json();

        // Create modal to show likers
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
                    <a href="/profile/${user.username}" style="
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
        if (error.message !== "Session expired") {
          console.error("Error fetching likes:", error);
          showMessage("Failed to load likes. Please try again.", "error");
        }
      }
    });
  }
}

// Image click handler for modal
document.body.addEventListener("click", (e) => {
  if (e.target.classList.contains("post-image")) {
    const images = Array.from(document.querySelectorAll(".post-image")).map(
      (img) => img.src
    );
    const clickedIndex = images.indexOf(e.target.src);
    openImageModal(images, clickedIndex);
  }
});
