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
    const author = post.Author?.Username || "Anonymous";
    const publishedDate = new Date(post.PublishedDate).toLocaleDateString();

    postCard.innerHTML = `
      <h3>${title}</h3>
      <p>${description}</p>
      <small>By ${author} on ${publishedDate}</small>
    `;

    postsContainer.appendChild(postCard);
  });
}
