// Reusable mobile sidebar for header actions
export function initMobileSidebar() {
  const header = document.querySelector("header");
  if (!header) return;

  // Create hamburger button
  let hamburger = document.getElementById("hamburgerToggle");
  if (!hamburger) {
    hamburger = document.createElement("button");
    hamburger.id = "hamburgerToggle";
    hamburger.className = "hamburger";
    hamburger.setAttribute("aria-label", "Open menu");
    hamburger.innerHTML = "<span></span><span></span><span></span>";
    // Insert near the start of header, after the first child (usually the title/logo)
    if (header.firstElementChild && header.firstElementChild.nextSibling) {
      header.insertBefore(hamburger, header.firstElementChild.nextSibling);
    } else {
      header.appendChild(hamburger);
    }
  }

  // Build sidebar + backdrop if not present
  let sidebar = document.getElementById("mobileSidebar");
  let backdrop = document.getElementById("mobileSidebarBackdrop");
  if (!sidebar) {
    sidebar = document.createElement("nav");
    sidebar.id = "mobileSidebar";
    sidebar.className = "mobile-sidebar";
    sidebar.innerHTML = `
      <div class="mobile-sidebar-header">
        <strong>Menu</strong>
        <button class="close-btn" aria-label="Close menu">×</button>
      </div>
      <ul class="mobile-menu"></ul>
    `;
    document.body.appendChild(sidebar);
  }
  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.id = "mobileSidebarBackdrop";
    backdrop.className = "mobile-backdrop";
    document.body.appendChild(backdrop);
  }

  const menuList = sidebar.querySelector(".mobile-menu");
  if (!menuList) return;
  menuList.innerHTML = "";

  // Collect actionable items inside header: buttons and anchors that look like actions
  const actions = Array.from(
    header.querySelectorAll(
      "a.btn, button, .header-buttons .btn, nav a, .nav-link, #notificationBell"
    )
  ).filter((el) => {
    // Skip the hamburger itself
    if (el === hamburger) return false;
    // Skip the title/logo link
    if (el.closest("header") === header && el.tagName === "H1") return false;
    return true;
  });

  // Hide on mobile via CSS hook
  actions.forEach((el) => el.classList.add("hide-on-mobile"));

  // Build cloned menu items that trigger original actions
  for (const el of actions) {
    const li = document.createElement("li");
    if (el.tagName === "A" && el.getAttribute("href")) {
      const a = document.createElement("a");
      a.textContent = el.textContent?.trim() || el.getAttribute("href");
      a.href = el.getAttribute("href");
      a.className = "mobile-link";
      li.appendChild(a);
    } else if (el.id === "notificationBell") {
      const a = document.createElement("a");
      a.textContent = "Notifications";
      a.href = "/blog";
      a.className = "mobile-link";
      li.appendChild(a);
    } else {
      const btn = document.createElement("button");
      btn.textContent = el.textContent?.trim() || "Action";
      btn.className = "mobile-btn";
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        try {
          el.click();
        } catch {}
        closeSidebar();
      });
      li.appendChild(btn);
    }
    menuList.appendChild(li);
  }

  const openSidebar = () => {
    sidebar.classList.add("open");
    backdrop.classList.add("open");
    document.body.style.overflow = "hidden";
  };
  const closeSidebar = () => {
    sidebar.classList.remove("open");
    backdrop.classList.remove("open");
    document.body.style.overflow = "";
  };

  hamburger.onclick = openSidebar;
  sidebar.querySelector(".close-btn").onclick = closeSidebar;
  backdrop.onclick = closeSidebar;
}
