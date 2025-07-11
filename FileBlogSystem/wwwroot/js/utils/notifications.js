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
export function showConfirmation(message, onConfirm, onCancel = null) {
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
    if (onConfirm) onConfirm();
  };

  dialog.querySelector("#confirm-no").onclick = () => {
    overlay.remove();
    if (onCancel) onCancel();
  };

  // Handle overlay click to close
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      overlay.remove();
      if (onCancel) onCancel();
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
