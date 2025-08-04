document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("jwtToken"); // match storage key used elsewhere

  // Only initialize notifications if the user is logged in
  if (!token) {
    console.log("No user token found, skipping notification setup.");
    return;
  }

  // Create a container for toasts
  const toastContainer = document.createElement("div");
  toastContainer.id = "toast-container";
  document.body.appendChild(toastContainer);

  // Use existing bell and badge in HTML (static markup in each page)
  const bell = document.getElementById("notificationBell");
  const notificationBadge = document.getElementById("bellUnreadCount");

  // --- 2. Define UI update functions ---

  function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `<div class="toast-message">${message}</div>`;
    toastContainer.appendChild(toast);

    // Animate in
    setTimeout(() => toast.classList.add("show"), 100);

    // Automatically remove after 5 seconds
    setTimeout(() => {
      toast.classList.remove("show");
      // Remove from DOM after transition
      toast.addEventListener("transitionend", () => toast.remove());
    }, 5000);
  }

  function updateUnreadCount(count) {
    if (!notificationBadge) return;

    if (count > 0) {
      notificationBadge.textContent = count > 9 ? "9+" : count;
      notificationBadge.classList.add("visible");
      // Show badge
      notificationBadge.style.display = "inline-block";
    } else {
      notificationBadge.classList.remove("visible");
      // Hide badge
      notificationBadge.style.display = "none";
    }
  }

  // --- 3. Setup SignalR Connection ---

  const connection = new signalR.HubConnectionBuilder()
    .withUrl("/notificationHub", {
      accessTokenFactory: () => token,
    })
    .withAutomaticReconnect()
    .build();

  // --- 4. Define what happens on received events ---

  // A new notification arrives
  connection.on("ReceiveNotification", (notification) => {
    console.log("New notification received:", notification);
    showToast(notification.Message);
  });

  // The unread count is updated (from any event)
  connection.on("UpdateUnreadCount", (count) => {
    console.log(`Updating unread count to: ${count}`);
    updateUnreadCount(count);
  });

  // --- 5. Start and manage the connection ---

  async function startSignalR() {
    try {
      await connection.start();
      console.log("SignalR Connected successfully.");
    } catch (err) {
      console.error("SignalR Connection Failed: ", err);
      // The 'withAutomaticReconnect' will handle retries,
      // but you could add custom logic here if needed.
    }
  }

  connection.onclose(() => {
    console.log("SignalR connection closed.");
  });

  startSignalR();
});
