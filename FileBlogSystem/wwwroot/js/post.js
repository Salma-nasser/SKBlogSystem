window.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const postSlug = urlParams.get("slug");
  if (!postSlug) {
    document.getElementById("postTitle").innerText = "Post not found.";
    document.getElementById("postDescription").innerText = "";
    return;
  }

  try {
    const token = localStorage.getItem("jwtToken"); // get JWT token

    const response = await fetch(
      `https://localhost:7189/api/posts/${postSlug}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (response.ok) {
      const post = await response.json();

      document.getElementById("postTitle").innerText = post.Title;
      document.getElementById("postDate").innerText = new Date(
        post.PublishedDate
      ).toLocaleString();
      document.getElementById("postDescription").innerText = post.Description;
      document.getElementById("postBody").innerHTML = post.Body;
      document.getElementById("authorName").innerText = post.Author;

      renderList("postTags", post.Tags, "Tags");
      renderList("postCategories", post.Categories, "Categories");

      // Load all images
      if (post.Images && post.Images.length > 0) {
        const imagesContainer = document.getElementById("postImages");
        const dateOnly = new Date(post.PublishedDate)
          .toISOString()
          .split("T")[0];

        post.Images.forEach((imagePath) => {
          const img = document.createElement("img");
          // Make sure to add slash before imagePath
          img.src = `https://localhost:7189/Content/posts/${dateOnly}-${post.Slug}/${imagePath}`;
          img.alt = "Post Image";
          img.classList.add("full-post-image");
          imagesContainer.appendChild(img);
        });
      }
    } else {
      document.getElementById("postTitle").innerText = "Post not found.";
      document.getElementById("postDescription").innerText = "";
    }
  } catch (error) {
    console.error(error);
    document.getElementById("postTitle").innerText = "Error loading post.";
    document.getElementById("postDescription").innerText = "";
  }
});

// Enable zoom on click for all images
document.addEventListener("click", (e) => {
  if (
    e.target.tagName === "IMG" &&
    e.target.classList.contains("full-post-image")
  ) {
    toggleImageZoom(e.target);
  }
});

function toggleImageZoom(img) {
  img.classList.toggle("zoomed");
}

// Back to Blog Button
document.getElementById("backToBlogBtn").addEventListener("click", () => {
  window.location.href = "blog.html";
});

function renderList(containerId, items, label) {
  const container = document.getElementById(containerId);
  if (items && items.length > 0) {
    const labelEl = document.createElement("strong");
    labelEl.innerText = label + ": ";
    container.appendChild(labelEl);

    items.forEach((item, index) => {
      const span = document.createElement("span");
      span.innerText = item;
      span.classList.add("tag");
      container.appendChild(span);
    });
  }
}
