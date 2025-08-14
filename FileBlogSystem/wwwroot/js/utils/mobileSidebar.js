// Reusable mobile sidebar for header actions
import { openNotificationsModal } from "./notifications.js";

export function initMobileSidebar() {
  // Find a suitable container: standard header or admin navbar container
  const container =
    document.querySelector("header") ||
    document.querySelector(".nav-container") ||
    document.querySelector(".navbar");
  if (!container) return;

  // Ensure positioning context for absolutely positioned hamburger
  const computedPos = window.getComputedStyle(container).position;
  if (computedPos === "static") container.style.position = "relative";

  // Create hamburger button
  let hamburger = document.getElementById("hamburgerToggle");
  if (!hamburger) {
    hamburger = document.createElement("button");
    hamburger.id = "hamburgerToggle";
    hamburger.className = "hamburger";
    hamburger.setAttribute("aria-label", "Open menu");
    hamburger.innerHTML = "<span></span><span></span><span></span>";
    if (
      container.firstElementChild &&
      container.firstElementChild.nextSibling
    ) {
      container.insertBefore(
        hamburger,
        container.firstElementChild.nextSibling
      );
    } else {
      container.appendChild(hamburger);
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

  // Helpers
  const isAdminUser = () => {
    try {
      const token = localStorage.getItem("jwtToken");
      if (!token) return false;
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
      const payload = JSON.parse(jsonPayload);
      const role =
        payload.role ||
        payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"];
      return role === "Admin";
    } catch {
      return false;
    }
  };
  const isVisible = (el) => {
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    return el.offsetWidth > 0 || el.offsetHeight > 0;
  };

  // Collect actionable header items
  const actions = Array.from(
    container.querySelectorAll(
      "a.btn, button, .header-buttons .btn, nav a, .nav-link, #notificationBell"
    )
  ).filter((el) => {
    if (el === hamburger) return false; // skip hamburger
    if (el.id === "adminBtn" && !isAdminUser()) return false; // role gate
    if (!isVisible(el)) return false; // only visible
    return true;
  });

  // If user is admin but Admin button wasn't visible when cloning, add it explicitly
  const adminAlreadyPresent = actions.some((el) => el.id === "adminBtn");
  const shouldAddAdmin = isAdminUser() && !adminAlreadyPresent;

  // Hide original actions on mobile; cloned ones will appear in drawer
  actions.forEach((el) => el.classList.add("hide-on-mobile"));

  for (const el of actions) {
    const li = document.createElement("li");
    if (el.id === "notificationBell") {
      const a = document.createElement("a");
      const unread = document.getElementById("bellUnreadCount");
      const currentCount =
        unread && unread.textContent ? unread.textContent : "";
      a.textContent = currentCount
        ? `Notifications (${currentCount})`
        : "Notifications";
      a.href = "#";
      a.className = "mobile-link";
      a.addEventListener("click", (e) => {
        e.preventDefault();
        openNotificationsModal();
        closeSidebar();
      });
      // keep label in sync with unread count updates
      const updateLabel = (count) => {
        a.textContent =
          count > 0
            ? `Notifications (${count > 99 ? "99+" : count})`
            : "Notifications";
      };
      window.addEventListener("notifications:unreadCount", (ev) => {
        const c = ev?.detail?.count ?? 0;
        updateLabel(c);
      });
      li.appendChild(a);
    } else if (el.tagName === "A" && el.getAttribute("href")) {
      const a = document.createElement("a");
      a.textContent = el.textContent?.trim() || el.getAttribute("href");
      a.href = el.getAttribute("href");
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

  // Append explicit Admin link if needed
  if (shouldAddAdmin) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.className = "mobile-link";
    a.textContent = "Admin";
    a.href = "/admin";
    li.appendChild(a);
    menuList.appendChild(li);
  }

  const openSidebar = () => {
    sidebar.classList.add("open");
    backdrop.classList.add("open");
    hamburger.classList.add("open");
    document.body.style.overflow = "hidden";
  };
  const closeSidebar = () => {
    sidebar.classList.remove("open");
    backdrop.classList.remove("open");
    hamburger.classList.remove("open");
    document.body.style.overflow = "";
  };

  hamburger.onclick = openSidebar;
  sidebar.querySelector(".close-btn").onclick = closeSidebar;
  backdrop.onclick = closeSidebar;
}
