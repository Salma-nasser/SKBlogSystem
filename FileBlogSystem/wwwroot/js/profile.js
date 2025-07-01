window.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("jwtToken");
  if (!token) return (window.location.href = "login.html");

  loadUserData();
  loadUserDrafts();

  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    localStorage.removeItem("jwtToken");
    window.location.href = "login.html";
  });

  document.getElementById("backToBlogBtn")?.addEventListener("click", () => {
    window.location.href = "blog.html";
  });
});

function loadUserData() {
  const token = localStorage.getItem("jwtToken");
  const payload = JSON.parse(atob(token.split(".")[1]));
  const username =
    payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"];
  const email =
    payload[
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
    ];

  const userInfoSection = document.getElementById("userInfo");
  userInfoSection.innerHTML = `
    <h2>Profile Info</h2>
    <p><strong>Username:</strong> ${username}</p>
    <p><strong>Email:</strong> ${email}</p>
  `;
}

function loadUserDrafts() {
  const token = localStorage.getItem("jwtToken");

  fetch("https://localhost:7189/api/posts/drafts", {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((res) => res.json())
    .then((drafts) => renderDrafts(drafts))
    .catch((err) => console.error("Failed to fetch drafts:", err));
}

function renderDrafts(drafts) {
  const draftsContainer = document.getElementById("draftsContainer");
  draftsContainer.innerHTML = "";

  if (drafts.length === 0) {
    draftsContainer.innerHTML = "<p>No drafts or scheduled posts found.</p>";
    return;
  }

  drafts.forEach((post) => {
    const draftCard = document.createElement("div");
    draftCard.className = "post-card";
    draftCard.dataset.slug = post.Slug;

    const scheduledDate = post.ScheduledDate
      ? new Date(post.ScheduledDate).toLocaleString()
      : "Not scheduled";

    draftCard.innerHTML = `
      <h3>${post.Title || "Untitled Draft"}</h3>
      <p>${post.Description || "No description"}</p>
      <p>${post.Body.slice(0, 100)}...</p>
      ${
        scheduledDate === "Not scheduled"
          ? `<button class="publishBtn">Publish</button>`
          : ""
      }
      <small>Scheduled: ${scheduledDate}</small><br>
      <button class="modifyDraftBtn">Modify</button>
    `;

    draftsContainer.appendChild(draftCard);
  });
}

document.addEventListener("click", async (e) => {
  // Handle Modify Draft button
  if (e.target.classList.contains("modifyDraftBtn")) {
    const postCard = e.target.closest(".post-card");
    const slug = postCard.dataset.slug;
    loadDraftDetails(slug);
  }

  // Handle Publish button
  if (e.target.classList.contains("publishBtn")) {
    const postCard = e.target.closest(".post-card");
    const slug = postCard.dataset.slug;

    const token = localStorage.getItem("jwtToken");
    if (!token) return alert("You must be logged in to publish a post.");

    try {
      const res = await fetch(
        `https://localhost:7189/api/posts/publish/${slug}`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok)
        throw new Error(`Server responded with status ${res.status}`);

      if (res.status === 200) {
        showMessageBanner("Post published successfully!", "success");
        setTimeout(() => {
          window.location.reload(); // Full page reload to update the view
        }, 1000); // Optional delay to allow the banner to show briefly
      }
    } catch (err) {
      console.error("Error publishing post:", err);
      showMessageBanner("Failed to publish post. Please try again.", "error");
    }
  }
});

function loadDraftDetails(slug) {
  const token = localStorage.getItem("jwtToken");

  fetch(`https://localhost:7189/api/posts/${slug}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((res) => res.json())
    .then((post) => {
      document.getElementById("modifyTitle").value = post.Title;
      document.getElementById("modifyDescription").value = post.Description;
      document.getElementById("modifyBody").value = post.Body;
      document.getElementById("modifyCustomUrl").value = post.CustomUrl || "";
      document.getElementById("modifyTags").value = post.Tags.join(", ");
      document.getElementById("modifyCategories").value =
        post.Categories.join(", ");
      document.getElementById("modifyScheduledDate").value = post.ScheduledDate
        ? new Date(post.ScheduledDate).toISOString().slice(0, 16)
        : "";
      document.getElementById("postSlug").value = post.Slug;

      document.getElementById("modifyPostModal").classList.remove("hidden");
    })
    .catch((err) => {
      console.error("Failed to load post:", err);
      alert("Failed to load post details. Please try again.");
    });
}

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
        `https://localhost:7189/api/posts/modify/${slug}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      if (!res.ok)
        throw new Error(`Server responded with status ${res.status}`);

      if (res.status === 200) {
        alert("Post modified successfully!");
        form.reset(); // Clear form fields
        loadUserDrafts(); // Refresh drafts
        document.getElementById("modifyPostModal")?.classList.add("hidden");
      }
    } catch (err) {
      console.error("Error modifying post:", err);
      alert("Failed to modify post. Please try again.");
    }
  });

document.getElementById("closeModifyModal")?.addEventListener("click", () => {
  document.getElementById("modifyPostModal")?.classList.add("hidden");
});

function showMessageBanner(message, type) {
  const banner = document.getElementById("messageBanner");
  banner.textContent = message;
  banner.className = "";
  banner.classList.add(type === "success" ? "success" : "error");
  banner.classList.remove("hidden");

  setTimeout(() => {
    banner.classList.add("hidden");
  }, 3000);
}
