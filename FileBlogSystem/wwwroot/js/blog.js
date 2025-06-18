window.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("jwtToken");
  const username = new URLSearchParams(window.location.search).get("username");

  // Redirect to login if token is missing
  if (!token)
    return (window.location.href = "http://localhost:5000/api/auth/login");

  // Show username if available
  if (username) {
    const usernameSpan = document.getElementById("username");
    if (usernameSpan) usernameSpan.textContent = username;
  }

  // Fetch and render posts
  fetch("http://localhost:5000/api/posts", {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((res) => res.json())
    .then((posts) => renderPosts(posts))
    .catch((err) => console.error("Failed to fetch posts:", err));

  // Logout handler
  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    localStorage.removeItem("jwtToken");
    window.location.href = "login.html";
  });
});

function renderPosts(posts) {
  const postsContainer = document.getElementById("postsContainer");
  postsContainer.innerHTML = "";

  posts.forEach((post) => {
    const postCard = document.createElement("div");
    postCard.className = "post-card";

    const title = post.Title || "Untitled";
    const description = post.Description || "No description provided.";
    const body = post.Body || "No content available.";
    const author = post.Author?.Username || "Anonymous";
    const publishedDate = new Date(post.PublishedDate).toLocaleDateString();
    const modifiedDate = post.ModifiedDate
      ? new Date(post.ModifiedDate).toLocaleDateString()
      : "";

    postCard.dataset.slug = post.CustomUrl; // use this when rendering posts

    postCard.innerHTML = `
      <h3>${title}</h3>
      <p>${description}</p>
      <div class="post-body">${body}</div>
      <small>By ${author} on ${publishedDate}</small>
      <button class="modifyBtn">Modify</button>
    `;

    postsContainer.appendChild(postCard);
  });
}

document.getElementById("newPostBtn")?.addEventListener("click", () => {
  const modal = document.getElementById("postModal");
  if (modal) modal.classList.remove("hidden");
});
document.getElementById("closeModal")?.addEventListener("click", () => {
  const modal = document.getElementById("postModal");
  if (modal) modal.classList.add("hidden");
});

document
  .getElementById("createPostForm")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const token = localStorage.getItem("jwtToken");
    if (!token) return alert("You must be logged in to publish a post.");

    const form = e.target;
    const postData = {
      Title: form.title.value,
      Description: form.description.value,
      Body: form.body.value,
      Tags: [], // You can add a way for users to input tags, e.g. split from comma-separated field
      Categories: [], // Same idea as tags
      CustomUrl: form.customUrl.value,
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
      }

      document.getElementById("postModal")?.classList.add("hidden");
    } catch (err) {
      console.error("Error creating post:", err);
      showMessageBanner("Failed to publish post. Please try again.", "error");
    }
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

    const modal = document.getElementById("modifyPostModal");
    if (modal) modal.classList.remove("hidden");
  }
});
document
  .getElementById("modifyPostForm")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const token = localStorage.getItem("jwtToken");
    if (!token) return alert("You must be logged in to modify a post.");

    const form = e.target;
    const postData = {
      Title: form.modifyTitle.value,
      Description: form.modifyDescription.value,
      Body: form.modifyBody.value,
      Tags: [], // Handle tags as needed
      Categories: [], // Handle categories as needed
      CustomUrl: form.modifyCustomUrl.value,
    };

    try {
      const res = await fetch(
        `http://localhost:5000/api/posts/modify/${form.postSlug.value}`,
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
      }

      document.getElementById("modifyPostModal")?.classList.add("hidden");
    } catch (err) {
      console.error("Error modifying post:", err);
      showMessageBanner("Failed to modify post. Please try again.", "error");
    }
  });
document.getElementById("closeModifyModal")?.addEventListener("click", () => {
  const modal = document.getElementById("modifyPostModal");
  if (modal) modal.classList.add("hidden");
});
