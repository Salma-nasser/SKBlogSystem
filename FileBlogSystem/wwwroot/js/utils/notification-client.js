document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem("jwt_token");

    // Only initialize notifications if the user is logged in
    if (!token) {
        console.log("No user token found, skipping notification setup.");
        return;
    }

    // --- 1. Dynamically create and inject the UI elements ---

    // Create a container for toasts
    const toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);

    // Find the header to inject the bell into
    const header = document.querySelector('header');
    if (header) {
        const bell = document.createElement('div');
        bell.className = 'notification-bell';
        bell.innerHTML = `
            <span>&#128276;</span> <!-- Bell character -->
            <span class="count-badge">0</span>
        `;
        // Add it as the first element in the header's right-side div
        const headerActions = header.querySelector('div');
        if (headerActions) {
            headerActions.prepend(bell);
        }
    }

    const notificationBadge = document.querySelector('.notification-bell .count-badge');

    // --- 2. Define UI update functions ---

    function showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `<div class="toast-message">${message}</div>`;
        toastContainer.appendChild(toast);

        // Animate in
        setTimeout(() => toast.classList.add('show'), 100);

        // Automatically remove after 5 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            // Remove from DOM after transition
            toast.addEventListener('transitionend', () => toast.remove());
        }, 5000);
    }

    function updateUnreadCount(count) {
        if (!notificationBadge) return;

        if (count > 0) {
            notificationBadge.textContent = count > 9 ? '9+' : count;
            notificationBadge.classList.add('visible');
        } else {
            notificationBadge.classList.remove('visible');
        }
    }

    // --- 3. Setup SignalR Connection ---

    const connection = new signalR.HubConnectionBuilder()
        .withUrl("/notificationHub", {
            accessTokenFactory: () => token
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
    };

    connection.onclose(() => {
        console.log("SignalR connection closed.");
    });

    startSignalR();
});