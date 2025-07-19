// Ather&ink Blog Entrance Page JavaScript

document.addEventListener("DOMContentLoaded", function () {
  // Mobile menu functionality
  const mobileMenuBtn = document.getElementById("mobileMenuBtn");
  const nav = document.querySelector(".nav");

  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener("click", function () {
      nav.classList.toggle("nav-open");
      const icon = this.querySelector("i");
      icon.classList.toggle("fa-bars");
      icon.classList.toggle("fa-times");
    });
  }

  // Smooth scrolling for anchor links
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute("href"));
      if (target) {
        target.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    });
  });

  // Intersection Observer for animations
  const observerOptions = {
    threshold: 0.1,
    rootMargin: "0px 0px -50px 0px",
  };

  const observer = new IntersectionObserver(function (entries) {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.animationPlayState = "running";
        entry.target.classList.add("animate");
      }
    });
  }, observerOptions);

  // Observe elements for animation
  const animatedElements = document.querySelectorAll(
    ".featured-story, .community-post, .stat-item, .section-header, .cta-content"
  );
  animatedElements.forEach((el) => {
    observer.observe(el);
  });

  // Counter animation for stats
  function animateCounter(element, target, duration = 2000) {
    let start = 0;
    const increment = target / (duration / 16);

    function updateCounter() {
      start += increment;
      if (start < target) {
        element.textContent = Math.floor(start).toLocaleString();
        requestAnimationFrame(updateCounter);
      } else {
        element.textContent = target.toLocaleString();
      }
    }

    updateCounter();
  }

  // Animate stats when they come into view
  const statsObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const statNumber = entry.target.querySelector(".stat-number");
          const targetValue = parseInt(
            statNumber.textContent.replace(/,/g, "")
          );
          animateCounter(statNumber, targetValue);
          statsObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 }
  );

  document.querySelectorAll(".stat-item").forEach((stat) => {
    statsObserver.observe(stat);
  });

  // Parallax effect for hero background
  window.addEventListener("scroll", function () {
    const scrolled = window.pageYOffset;
    const hero = document.querySelector(".hero");
    if (hero) {
      const rate = scrolled * -0.5;
      hero.style.transform = `translateY(${rate}px)`;
    }
  });

  // Button click handlers
  document.querySelectorAll(".btn").forEach((button) => {
    button.addEventListener("click", function (e) {
      // Add ripple effect
      const ripple = document.createElement("span");
      ripple.classList.add("ripple");
      const rect = this.getBoundingClientRect();
      ripple.style.left = `${e.clientX - rect.left}px`;
      ripple.style.top = `${e.clientY - rect.top}px`;
      this.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    });
  });

  // Fetch and display featured stories
  async function fetchFeaturedStories() {
    try {
      const response = await fetch("/api/posts/published");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const posts = await response.json();

      const featuredStoryList = document.querySelector(".featured-story-list");
      const communityGrid = document.querySelector(".community-grid");

      if (featuredStoryList) {
        featuredStoryList.innerHTML = ""; // Clear placeholder content
        const featuredPosts = posts.slice(0, 3); // Take first 3 for featured section

        featuredPosts.forEach((post, index) => {
          const postElement = createFeaturedStoryElement(post, index);
          featuredStoryList.appendChild(postElement);
        });
      }

      if (communityGrid) {
        communityGrid.innerHTML = ""; // Clear placeholder content
        const communityPosts = posts.slice(3, 9); // Take next 6 for community grid

        communityPosts.forEach((post) => {
          const postElement = createCommunityPostElement(post);
          communityGrid.appendChild(postElement);
        });
      }
    } catch (error) {
      console.error("Failed to fetch posts:", error);
      const featuredStoryList = document.querySelector(".featured-story-list");
      if (featuredStoryList) {
        featuredStoryList.innerHTML =
          "<p>Could not load featured stories. Please try again later.</p>";
      }
      const communityGrid = document.querySelector(".community-grid");
      if (communityGrid) {
        communityGrid.innerHTML =
          "<p>Could not load community stories. Please try again later.</p>";
      }
    }
  }

  function createFeaturedStoryElement(post, index) {
    const article = document.createElement("article");
    article.className = `featured-story ${index % 2 !== 0 ? "reverse" : ""}`;

    const storyImage = document.createElement("div");
    storyImage.className = "story-image";
    const img = document.createElement("img");
    img.src = post.coverImagePath || "placeholders/assets/post_placeholder.jpg";
    img.alt = post.title;
    storyImage.appendChild(img);

    const storyContent = document.createElement("div");
    storyContent.className = "story-content";

    const authorHtml = `
            <div class="story-author">
                <img src="${
                  post.authorProfilePicture || "placeholders/profile.png"
                }" alt="${
      post.author
    }" class="author-avatar" onclick="promptLoginOrRedirect('${post.author}')">
                <div class="author-info">
                    <p class="author-name" onclick="promptLoginOrRedirect('${
                      post.author
                    }')">${post.author}</p>
                    <div class="story-meta">
                        ${
                          post.categories && post.categories.length > 0
                            ? `<span class="category-tag">${post.categories[0]}</span>`
                            : ""
                        }
                        <span class="read-time">
                            <i class="fas fa-clock"></i>
                            ${post.readTimeMinutes || 5} min
                        </span>
                    </div>
                </div>
            </div>
        `;

    const statsHtml = `
            <div class="story-footer">
                <div class="story-stats">
                    <span class="stat" onclick="promptLogin()">
                        <i class="fas fa-heart"></i>
                        ${post.likes ? post.likes.length : 0}
                    </span>
                    <span class="stat">
                        <i class="fas fa-comment"></i>
                        ${post.commentsCount || 0}
                    </span>
                </div>
                <button class="btn btn-ghost" onclick="location.href='post.html?slug=${
                  post.slug
                }'">
                    Read More
                    <i class="fas fa-arrow-right"></i>
                </button>
            </div>
        `;

    storyContent.innerHTML = `
            ${authorHtml}
            <h4 class="story-title">${post.title}</h4>
            <p class="story-excerpt">${post.excerpt}</p>
            ${statsHtml}
        `;

    article.appendChild(storyImage);
    article.appendChild(storyContent);
    return article;
  }

  function createCommunityPostElement(post) {
    const article = document.createElement("article");
    article.className = "community-post";

    const authorHtml = `
            <div class="post-header">
                <div class="post-author">
                    <img src="${
                      post.authorProfilePicture || "placeholders/profile.png"
                    }" alt="${
      post.author
    }" class="author-avatar-small" onclick="promptLoginOrRedirect('${
      post.author
    }')">
                    <div class="author-info-small">
                        <p class="author-name-small" onclick="promptLoginOrRedirect('${
                          post.author
                        }')">${post.author}</p>
                        ${
                          post.categories && post.categories.length > 0
                            ? `<span class="category-tag-small">${post.categories[0]}</span>`
                            : ""
                        }
                    </div>
                </div>
            </div>
        `;

    const statsHtml = `
            <div class="post-footer">
                <div class="post-stats">
                    <span class="stat-small" onclick="promptLogin()">
                        <i class="fas fa-heart"></i>
                        ${post.likes ? post.likes.length : 0}
                    </span>
                    <span class="stat-small">
                        <i class="fas fa-comment"></i>
                        ${post.commentsCount || 0}
                    </span>
                </div>
                <button class="btn btn-ghost-small" onclick="location.href='post.html?slug=${
                  post.slug
                }'">Read More</button>
            </div>
        `;

    article.innerHTML = `
            ${authorHtml}
            <h4 class="post-title">${post.title}</h4>
            <p class="post-excerpt">${post.excerpt}</p>
            ${statsHtml}
        `;
    return article;
  }

  window.promptLogin = function () {
    if (
      confirm(
        "You need to be logged in to perform this action. Do you want to join the community?"
      )
    ) {
      window.location.href = "register.html";
    }
  };

  window.promptLoginOrRedirect = function (author) {
    if (
      confirm(
        "You need to be logged in to view user profiles. Do you want to join the community?"
      )
    ) {
      window.location.href = "register.html";
    }
  };

  // Initial fetch
  fetchFeaturedStories();
});

// Additional CSS for JavaScript functionality
const additionalStyles = `
    .nav-open {
        display: flex !important;
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: var(--warm-cream);
        flex-direction: column;
        padding: 20px;
        border-top: 1px solid var(--border-color);
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
        transform: scale(0);
        animation: ripple-animation 0.6s linear;
        pointer-events: none;
    }

    @keyframes ripple-animation {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }

    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        border-radius: var(--border-radius);
        color: white;
        font-weight: 500;
        z-index: 10000;
        transform: translateX(100%);
        transition: transform 0.3s ease;
    }

    .notification.show {
        transform: translateX(0);
    }

    .notification-success {
        background: var(--sage-green);
    }

    .notification-error {
        background: #e74c3c;
    }

    .notification-info {
        background: #3498db;
    }

    .lazy {
        opacity: 0;
        transition: opacity 0.3s;
    }

    .lazy.loaded {
        opacity: 1;
    }

    .header {
        transition: transform 0.3s ease;
    }

    @media (max-width: 768px) {
        .nav-open .nav-link {
            padding: 12px 0;
            border-bottom: 1px solid var(--border-color);
        }
        
        .nav-open .btn {
            margin-top: 16px;
            align-self: flex-start;
        }
    }
`;

// Inject additional styles
const styleSheet = document.createElement("style");
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);
