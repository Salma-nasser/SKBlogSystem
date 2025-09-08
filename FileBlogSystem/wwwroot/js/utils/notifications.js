// Global notification system for the blog application
export function showMessage(message, type = "info") {
  // Remove any existing messages
  const existingMessage = document.querySelector(".notification-message");
  if (existingMessage) {
    existingMessage.remove();
  }

  const messageEl = document.createElement("div");
  messageEl.className = `notification-message notification-${type}`;
  messageEl.innerHTML = `
    <div class="notification-content">
      <span class="notification-text">${message}</span>
      <button class="notification-close" onclick="this.parentElement.parentElement.remove()">✖</button>
    </div>
  `;

  // Add styles
  messageEl.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10000;
    padding: 16px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    max-width: 400px;
    animation: slideIn 0.3s ease;
    font-size: 14px;
    font-weight: 500;
  `;

  // Set colors based on type
  switch (type) {
    case "success":
      messageEl.style.background = "var(--accent-color, #c89b7b)";
      messageEl.style.color = "white";
      break;
    case "error":
      messageEl.style.background = "#dc3545";
      messageEl.style.color = "white";
      break;
    case "warning":
      messageEl.style.background = "#ffc107";
      messageEl.style.color = "#212529";
      break;
    default:
      messageEl.style.background = "var(--button-bg, #8c6e63)";
      messageEl.style.color = "white";
  }

  // Style the content
  const content = messageEl.querySelector(".notification-content");
  content.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  `;

  // Style the close button
  const closeBtn = messageEl.querySelector(".notification-close");
  closeBtn.style.cssText = `
    background: transparent;
    border: none;
    color: inherit;
    cursor: pointer;
    font-size: 16px;
    padding: 0;
    margin-left: 10px;
  `;

  document.body.appendChild(messageEl);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (messageEl.parentNode) {
      messageEl.remove();
    }
  }, 5000);
}

// Custom confirmation dialog
export function showConfirmation(
  titleOrMessage,
  messageOrOnConfirm,
  onConfirmOrOnCancel = null,
  onCancel = null
) {
  let title, message, onConfirm, onCancelCallback;

  // Handle different parameter patterns
  if (typeof messageOrOnConfirm === "string") {
    // Pattern: showConfirmation(title, message, onConfirm, onCancel)
    title = titleOrMessage;
    message = messageOrOnConfirm;
    onConfirm = onConfirmOrOnCancel;
    onCancelCallback = onCancel;
  } else {
    // Pattern: showConfirmation(message, onConfirm, onCancel)
    title = null;
    message = titleOrMessage;
    onConfirm = messageOrOnConfirm;
    onCancelCallback = onConfirmOrOnCancel;
  }

  // Create overlay
  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 10001;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.2s ease;
  `;

  // Create dialog
  const dialog = document.createElement("div");
  dialog.style.cssText = `
    background: var(--card-bg, white);
    color: var(--text-color, black);
    padding: 24px;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    max-width: 400px;
    margin: 20px;
    text-align: center;
  `;

  dialog.innerHTML = `
    ${
      title
        ? `<div style="margin-bottom: 12px; font-size: 18px; font-weight: 600; color: var(--accent-color, #c89b7b);">${title}</div>`
        : ""
    }
    <div style="margin-bottom: 20px; font-size: 16px; line-height: 1.5;">${message}</div>
    <div style="display: flex; gap: 12px; justify-content: center;">
      <button id="confirm-yes" style="
        background: var(--accent-color, #c89b7b);
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
      ">Yes</button>
      <button id="confirm-no" style="
        background: var(--button-bg, #8c6e63);
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
      ">No</button>
    </div>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  // Handle clicks
  dialog.querySelector("#confirm-yes").onclick = () => {
    overlay.remove();
    if (typeof onConfirm === "function") {
      onConfirm();
    }
  };

  dialog.querySelector("#confirm-no").onclick = () => {
    overlay.remove();
    if (typeof onCancelCallback === "function") {
      onCancelCallback();
    }
  };

  // Handle overlay click to close
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      overlay.remove();
      if (typeof onCancelCallback === "function") {
        onCancelCallback();
      }
    }
  };
}

// Initialize notification styles
if (!document.querySelector("#notification-styles")) {
  const style = document.createElement("style");
  style.id = "notification-styles";
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);
}

// === Reusable Notifications Modal (desktop + mobile) ===
/**
 * Opens the notifications modal and populates it with the user's notifications.
 * Each unread notification shows a left accent bar and is clickable to mark as read.
 * Includes a "Mark all as read" action.
 */
export function openNotificationsModal() {
  ensureNotificationsModal();
  const modal = document.getElementById("notificationsModal");
  const body = document.getElementById("notificationsModalBody");
  if (!modal) return;
  if (!body) {
    // If body is missing, rebuild modal contents and continue
    buildNotificationsModalContents(modal);
  }
  const bodyEl = document.getElementById("notificationsModalBody");
  if (!bodyEl) return;
  bodyEl.innerHTML = "<div style='color:#8a7a6e'>Loading...</div>";

  // Load and render
  loadNotifications()
    .then((notifications) => {
      renderNotificationsList(notifications);
      updateUnreadBadgeFromList(notifications);
      updateMarkAllButtonVisibility(notifications);
      broadcastUnreadFromList(notifications);
    })
    .catch(() => {
      bodyEl.innerHTML =
        "<div style='color:#8a7a6e'>Failed to load notifications.</div>";
    });

  modal.style.display = "flex";
}

function ensureNotificationsModal() {
  let notifModal = document.getElementById("notificationsModal");
  if (!notifModal) {
    notifModal = document.createElement("div");
    notifModal.id = "notificationsModal";
    notifModal.style.cssText = `
      position: fixed; inset: 0; z-index: 1202; display: none;
      background: rgba(0,0,0,0.45); backdrop-filter: blur(2px);
      align-items: center; justify-content: center; padding: 16px;
    `;
    buildNotificationsModalContents(notifModal);
    document.body.appendChild(notifModal);
  }
  // If the modal exists but doesn't have our expected body, rebuild contents
  if (!document.getElementById("notificationsModalBody")) {
    buildNotificationsModalContents(notifModal);
  }
}

function buildNotificationsModalContents(notifModal) {
  notifModal.innerHTML = `
    <div style="max-width: 520px; width: 100%; background: var(--bg-secondary, #fff); color: var(--text-color, #2c1810); border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.25); overflow: hidden;">
      <div style="display:flex; align-items:center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--border-color, #e6d9c9);">
        <h3 style="margin:0; font-size:1.1rem; color: var(--primary-color, #8b4513);">Notifications</h3>
        <div>
          <button id="markAllReadBtn" type="button" class="btn btn--ghost" style="margin-right:8px;">Mark all as read</button>
          <button id="closeNotificationsModal" type="button" class="btn btn--ghost">Close</button>
        </div>
      </div>
      <div id="notificationsModalBody" style="max-height: 70vh; overflow:auto; padding: 12px 16px;"></div>
    </div>`;
  // Delegate clicks for buttons to be resilient across rerenders
  notifModal.onclick = async (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.id === "closeNotificationsModal") {
      notifModal.style.display = "none";
      return;
    }
    if (target.id === "markAllReadBtn") {
      try {
        await authFetch("/notifications/mark-all-read", { method: "POST" });
        const list = await loadNotifications();
        renderNotificationsList(list);
        updateUnreadBadgeFromList(list);
        updateMarkAllButtonVisibility(list);
        broadcastUnreadFromList(list);
      } catch (e) {
        console.error("Failed to mark all as read", e);
      }
    }
  };
}

async function loadNotifications() {
  const res = await authFetch("/notifications?all=true");
  return res.json();
}

// Backwards-compatible alias used by older client code
export async function getAllNotifications() {
  return await loadNotifications();
}

function updateUnreadBadgeFromList(list) {
  const badge = document.getElementById("bellUnreadCount");
  if (!badge) return;
  const unread = (list || []).filter((n) => !n.IsRead).length;
  if (unread > 0) {
    badge.textContent = unread > 99 ? "99+" : unread;
    badge.style.display = "inline-block";
  } else {
    badge.style.display = "none";
  }
}

// Also show/hide the 'Mark all as read' button based on unread count
function updateMarkAllButtonVisibility(list) {
  const btn = document.getElementById("markAllReadBtn");
  if (!btn) return;
  const unread = (list || []).filter((n) => !n.IsRead).length;
  if (unread > 0) {
    btn.style.display = "inline-block";
  } else {
    btn.style.display = "none";
  }
}

function broadcastUnreadFromList(list) {
  const unread = (list || []).filter((n) => !n.IsRead).length;
  try {
    window.dispatchEvent(
      new CustomEvent("notifications:unreadCount", {
        detail: { count: unread },
      })
    );
  } catch {}
}

function renderNotificationsList(notifications) {
  const body = document.getElementById("notificationsModalBody");
  if (!body) return;
  body.innerHTML = "";
  if (!notifications || notifications.length === 0) {
    body.innerHTML = "<div style='color:#8a7a6e'>No notifications yet.</div>";
    return;
  }

  const listEl = document.createElement("div");
  notifications.forEach((n) => {
    const item = document.createElement("div");
    item.style.cssText =
      "background:#ffe4b5;color:#2c1810;border-radius:7px;padding:10px 12px;margin-bottom:10px;font-size:0.98rem;cursor:pointer;";
    if (!n.IsRead) item.style.borderLeft = "4px solid #8b4513";
    item.innerHTML = `<div>${
      n.Message
    }</div><div style='font-size:0.8em;color:#8a7a6e;'>${new Date(
      n.CreatedAt
    ).toLocaleString()}</div>`;
    item.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        if (!n.IsRead) {
          await authFetch(`/notifications/read/${n.Id}`, { method: "POST" });
          n.IsRead = true; // optimistic
          item.style.borderLeft = "none"; // hide accent banner
          // update badge by re-counting quickly
          const container = listEl; // already constructed
          const unreadLeft = notifications.filter((x) => !x.IsRead).length;
          const badge = document.getElementById("bellUnreadCount");
          if (badge) {
            if (unreadLeft > 0) {
              badge.textContent = unreadLeft > 99 ? "99+" : unreadLeft;
              badge.style.display = "inline-block";
            } else {
              badge.style.display = "none";
            }
          }
          // Broadcast for sidebar label
          broadcastUnreadFromList(notifications);
          // Update the mark-all button visibility
          updateMarkAllButtonVisibility(notifications);
        }
        // Close modal then navigate to the linked post (if any). Do this after marking read.
        const modal = document.getElementById("notificationsModal");
        if (modal) modal.style.display = "none";
        if (n.Link) {
          // Navigate to provided link (relative or absolute)
          window.location.href = n.Link;
        }
      } catch (err) {
        console.error("Failed to mark notification as read", err);
      }
    });
    listEl.appendChild(item);
  });
  body.appendChild(listEl);
}

// Minimal auth-aware fetch to avoid circular import with api.js
async function authFetch(url, options = {}) {
  const token = localStorage.getItem("jwtToken");
  const headers = new Headers(options.headers || {});
  if (token) headers.append("Authorization", `Bearer ${token}`);
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.append("Content-Type", "application/json");
  }
  const res = await fetch(url, { ...options, headers });
  return res;
}
