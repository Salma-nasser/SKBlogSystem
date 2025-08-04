import { showMessage } from "./notifications.js";

// Helper function to safely encode UTF-8 strings to base64
function safeBase64Encode(str) {
  try {
    // Convert string to UTF-8 bytes, then to base64
    return btoa(unescape(encodeURIComponent(str)));
  } catch (error) {
    console.error("Error encoding to base64:", error);
    // Fallback: just return the original string
    return str;
  }
}

// Helper function to safely decode base64 to UTF-8 strings
export function safeBase64Decode(encodedStr) {
  try {
    // Decode base64 to UTF-8 bytes, then to string
    return decodeURIComponent(escape(atob(encodedStr)));
  } catch (error) {
    console.error("Error decoding from base64:", error);
    // Fallback: try regular atob
    try {
      return atob(encodedStr);
    } catch (fallbackError) {
      console.error("Fallback decode also failed:", fallbackError);
      return encodedStr;
    }
  }
}

// Helper function to check if text needs read more functionality
function needsReadMore(text) {
  if (!text) return false;

  // First render the markdown to get the actual content
  const renderedHtml = renderMarkdown(text);
  const plainText = stripHtml(renderedHtml);

  // Count paragraphs by splitting on double newlines in the original markdown
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

  // Increased threshold - if more than 500 characters or 3 paragraphs, show read more
  return paragraphs.length > 3 || plainText.length > 500;
}

// Helper function to create truncated version of rendered HTML
function getTruncatedContent(
  text,
  maxLength = 500, // Increased from 300 to 500
  postSlug = "",
  publishedDate = ""
) {
  if (!text) return "";

  // First render the markdown with enhanced image handling
  const renderedHtml = renderMarkdownWithImageHandling(
    text,
    postSlug,
    publishedDate
  );
  const plainText = stripHtml(renderedHtml);

  // If the plain text is short enough, return the full rendered HTML
  if (plainText.length <= maxLength) {
    return renderedHtml;
  }

  // Return truncated version - the CSS will handle the visual truncation
  return renderedHtml;
}

// Helper function to render markdown content
function renderMarkdown(content) {
  if (!content) return "";

  // Check if marked library is available
  if (typeof marked !== "undefined") {
    try {
      const rawHtml = marked.parse(content);
      return DOMPurify.sanitize(rawHtml);
    } catch (error) {
      console.error("Error parsing markdown:", error);
      return content; // Fallback to raw content
    }
  }

  // Fallback: simple line break conversion if marked is not available
  return content.replace(/\n/g, "<br>");
}

// Enhanced markdown renderer with image processing
function renderMarkdownWithImageHandling(
  content,
  postSlug = "",
  publishedDate = ""
) {
  if (!content) return "";

  let renderedHtml = "";

  // Check if marked library is available
  if (typeof marked !== "undefined") {
    try {
      // Configure marked with custom renderer for images
      const renderer = new marked.Renderer();

      // Custom image renderer to handle both markdown images and existing post images
      renderer.image = function (href, title, text) {
        // Ensure href is a string
        const hrefStr = String(href);
        // Handle relative paths for post images
        let imageSrc = hrefStr;

        // If it's a relative path starting with /assets/, convert to full post path
        if (hrefStr.startsWith("/assets/") && postSlug && publishedDate) {
          const dateOnly = new Date(publishedDate).toISOString().split("T")[0];
          imageSrc = `/Content/posts/${dateOnly}-${postSlug}${hrefStr}`;
        }
        // If it's already a full URL or absolute path, use as-is
        else if (
          hrefStr.startsWith("http://") ||
          hrefStr.startsWith("https://") ||
          hrefStr.startsWith("/Content/")
        ) {
          imageSrc = hrefStr;
        }

        return `<img src="${imageSrc}" alt="${
          text || `Image from blog post: ${postSlug || "content"}`
        }" title="${
          title || ""
        }" class="markdown-image" style="max-width: 100%; height: auto; border-radius: 8px; margin: 10px 0; cursor: pointer;" onclick="openImageModal('${imageSrc}', '${
          text || `Image from blog post: ${postSlug || "content"}`
        }')">`;
      };

      const rawHtml = marked.parse(content, { renderer: renderer });
      renderedHtml = DOMPurify.sanitize(rawHtml);
    } catch (error) {
      console.error("Error parsing markdown:", error);
      renderedHtml = content; // Fallback to raw content
    }
  } else {
    // Fallback: simple line break conversion if marked is not available
    renderedHtml = content.replace(/\n/g, "<br>");
  }

  return renderedHtml;
}

// Function to open image in modal (will be defined globally)
function openImageModal(src, alt) {
  // Create modal HTML
  const modal = document.createElement("div");
  modal.className = "image-modal";
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    cursor: pointer;
  `;

  modal.innerHTML = `
    <div style="position: relative; max-width: 90%; max-height: 90%;">
      <img src="${src}" alt="${alt}" style="max-width: 100%; max-height: 100%; border-radius: 8px;">
      <button onclick="this.closest('.image-modal').remove()" style="position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.7); color: white; border: none; border-radius: 50%; width: 30px; height: 30px; cursor: pointer; font-size: 18px;">×</button>
    </div>
  `;

  // Close modal when clicking outside the image
  modal.addEventListener("click", function (e) {
    if (e.target === modal) {
      modal.remove();
    }
  });

  document.body.appendChild(modal);
}

// Make openImageModal globally available
if (typeof window !== "undefined") {
  window.openImageModal = openImageModal;
}

// Helper function to strip HTML tags for plain text extraction
function stripHtml(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

// Helper to split camelCase/concatenated words and capitalize each
function formatLabel(str) {
  // Insert space before capital letters, replace underscores/hyphens, then capitalize
  return str
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

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
        `<span class="tag clickable-tag" data-type="tag" data-value="${tag}">${formatLabel(
          tag
        )}</span>`
    ).join("");

    const catsHtml = post.Categories.map(
      (cat) =>
        `<span class="category clickable-tag" data-type="category" data-value="${cat}">${formatLabel(
          cat
        )}</span>`
    ).join("");

    let imgHtml = "";
    if (post.Images?.length) {
      const dateOnly = new Date(post.PublishedDate).toISOString().split("T")[0];
      imgHtml = `
        <div class="post-images post-images-${post.Images.length}">
          ${post.Images.map(
            (image, index) => `
            <img src="/Content/posts/${dateOnly}-${post.Slug}${image}"
                alt="Image ${index + 1} for blog post: ${post.Title}"
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
          ? `/profile/${currentUsername}`
          : `/profile/${post.Author}`;

      console.log("Author URL:", authorUrl);
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
        const encodedPost = safeBase64Encode(JSON.stringify(post));
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

    // If viewing a profile, make heart icon look clickable
    let likeToggleStyle = "";
    if (
      containerId === "profilePostsContainer" ||
      window.location.pathname.startsWith("/profile")
    ) {
      likeToggleStyle = "cursor:pointer;transition:transform 0.1s;";
    }

    const interactionBarHtml = `
      <div class="interaction-bar">
        <span class="like-toggle" data-slug="${post.Slug}" data-liked="${post.LikedByCurrentUser}" style="${likeToggleStyle}">
          ${likeIcon}
        </span>
        <span class="like-count" data-slug="${post.Slug}">${likeCount} Likes</span>
      </div>
    `;

    // Handle body content with read more functionality
    let bodyHtml = "";
    if (post.Body) {
      const needsExpansion = needsReadMore(post.Body);

      if (needsExpansion) {
        const truncatedContent = getTruncatedContent(
          post.Body,
          300,
          post.Slug,
          post.PublishedDate
        );
        const fullRenderedContent = renderMarkdownWithImageHandling(
          post.Body,
          post.Slug,
          post.PublishedDate
        );

        // Use link-based approach instead of button
        bodyHtml = `
          <div class="post-body truncated" data-full-content="${fullRenderedContent.replace(
            /"/g,
            "&quot;"
          )}" data-truncated-content="${truncatedContent.replace(
          /"/g,
          "&quot;"
        )}">${truncatedContent}</div>
          <div class="read-more">
            <a href="#" class="read-more-link" data-action="expand" aria-label="Read more of ${
              post.Title
            }">Read more<span class="sr-only"> of ${post.Title}</span></a>
          </div>
        `;
      } else {
        const renderedContent = renderMarkdownWithImageHandling(
          post.Body,
          post.Slug,
          post.PublishedDate
        );
        bodyHtml = `<div class="post-body">${renderedContent}</div>`;
      }
    }

    card.innerHTML = `
      <div class="post-content-wrapper">
        <h3><a href="/post/${post.Slug}">${post.Title}</a></h3>
        <p class="post-description">${post.Description}</p>
        ${imgHtml}
        ${bodyHtml}
      </div>
      
      <div class="post-footer">
        ${authorHtml}
        <div class="meta-info">
          <div><strong>Tags:</strong> ${tagsHtml || "—"}</div>
          <div><strong>Categories:</strong> ${catsHtml || "—"}</div>
        </div>
        ${interactionBarHtml}
        <div class="post-actions">${actionsHtml}</div>
      </div>
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

        const response = await fetch(`/api/posts/${slug}/like`, {
          method: liked ? "DELETE" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("jwtToken")}`,
          },
        });

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
        const response = await fetch(`/api/posts/${slug}/likes`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("jwtToken")}`,
          },
        });

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
        console.error("Error fetching likes:", error);
        showMessage("Failed to load likes. Please try again.", "error");
      }
    });
  });

  // Add event listeners for read more links (keep this)
  postsContainer.querySelectorAll(".read-more-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const postCard = link.closest(".post-card");
      const postBody = postCard.querySelector(".post-body");
      const postTitle = postCard.querySelector("h3 a").textContent;
      const action = link.dataset.action;

      if (action === "expand") {
        // Show full content
        const fullContent = postBody.dataset.fullContent;
        postBody.innerHTML = fullContent;
        postBody.classList.remove("truncated");
        link.innerHTML = `Read less<span class="sr-only"> of ${postTitle}</span>`;
        link.setAttribute("aria-label", `Read less of ${postTitle}`);
        link.dataset.action = "collapse";
      } else {
        // Show truncated content
        const truncatedContent = postBody.dataset.truncatedContent;
        postBody.innerHTML = truncatedContent;
        postBody.classList.add("truncated");
        link.innerHTML = `Read more<span class="sr-only"> of ${postTitle}</span>`;
        link.setAttribute("aria-label", `Read more of ${postTitle}`);
        link.dataset.action = "expand";
      }
    });
  });
}
