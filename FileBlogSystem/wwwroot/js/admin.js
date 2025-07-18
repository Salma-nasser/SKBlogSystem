// Admin Dashboard JavaScript

import { initializeThemeToggle } from "./utils/themeToggle.js";

class AdminDashboard {
  constructor() {
    this.users = [];
    this.currentUser = null;
    this.init();
  }

  async init() {
    // Initialize theme toggle
    initializeThemeToggle();

    // Check if user is admin
    await this.checkAdminAccess();

    // Set up event listeners
    this.setupEventListeners();

    // Load users
    await this.loadUsers();
  }

  async checkAdminAccess() {
    try {
      const token = localStorage.getItem("jwtToken");
      if (!token) {
        console.log("DEBUG: No JWT token found");
        this.redirectToLogin();
        return;
      }

      // Debug: Parse and log JWT token contents
      try {
        const base64Url = token.split(".")[1];
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split("")
            .map(function (c) {
              return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
            })
            .join("")
        );
        const payload = JSON.parse(jsonPayload);

        console.log("DEBUG: JWT Token Payload:", payload);
        console.log(
          "DEBUG: User Role in Token:",
          payload.role ||
            payload[
              "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"
            ]
        );
        console.log(
          "DEBUG: Username in Token:",
          payload.unique_name ||
            payload[
              "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"
            ]
        );
      } catch (parseError) {
        console.error("DEBUG: Error parsing JWT token:", parseError);
      }

      const response = await fetch("/api/admin/check", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      console.log("DEBUG: Admin check response status:", response.status);

      if (!response.ok) {
        const responseText = await response.text();
        console.log("DEBUG: Admin check failed response body:", responseText);

        if (response.status === 401 || response.status === 403) {
          console.log(
            "DEBUG: Access denied - not an admin or not authenticated"
          );
          this.showAccessDenied();
          return;
        }
        throw new Error("Failed to verify admin access");
      }

      const data = await response.json();
      console.log("DEBUG: Admin check successful:", data);
      this.currentUser = data.username;
    } catch (error) {
      console.error("Error checking admin access:", error);
      this.redirectToLogin();
    }
  }

  setupEventListeners() {
    // Logout button
    document
      .getElementById("logoutBtn")
      .addEventListener("click", this.logout.bind(this));

    // Modal event listeners
    document
      .getElementById("confirmYes")
      .addEventListener("click", this.confirmPromotion.bind(this));
    document
      .getElementById("confirmNo")
      .addEventListener("click", this.closeModal.bind(this));

    // Close modal when clicking outside
    document.getElementById("confirmModal").addEventListener("click", (e) => {
      if (e.target.id === "confirmModal") {
        this.closeModal();
      }
    });
  }

  async loadUsers() {
    try {
      this.showLoading();

      const token = localStorage.getItem("jwtToken");
      const response = await fetch("/api/admin/users", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load users");
      }

      this.users = await response.json();
      this.renderUsers();
      this.updateStats();
      this.hideLoading();
    } catch (error) {
      console.error("Error loading users:", error);
      this.showError("Failed to load users. Please try again.");
    }
  }

  renderUsers() {
    const tbody = document.getElementById("usersTableBody");
    tbody.innerHTML = "";

    this.users.forEach((user) => {
      const row = document.createElement("tr");
      row.innerHTML = `
      <td>
        <strong>${this.escapeHtml(user.Username)}</strong>
        ${
          user.Bio
            ? `<br><small class="text-muted">${this.escapeHtml(
                user.Bio
              )}</small>`
            : ""
        }
      </td>
      <td>${this.escapeHtml(user.Email)}</td>
      <td>
        <span class="role-badge role-${user.Role.toLowerCase()}">
          ${user.Role}
        </span>
      </td>
      <td>${this.formatDate(user.CreatedAt)}</td>
      <td>${this.formatDate(user.LastLoginDate)}</td>
      <td>
        <span class="status-badge status-${
          user.IsActive ? "active" : "inactive"
        }">
          ${user.IsActive ? "Active" : "Inactive"}
        </span>
      </td>
      <td>
        ${this.renderUserActions(user)}
      </td>
    `;
      tbody.appendChild(row);

      // Add event listeners after the row is added to the DOM
      const promoteBtn = row.querySelector(".promote-btn");
      if (promoteBtn) {
        promoteBtn.addEventListener("click", () => {
          this.showPromoteModal(user.Username);
        });
      }
    });
  }

  renderUserActions(user) {
    if (user.Username === this.currentUser) {
      return '<span class="text-muted">Current User</span>';
    }

    if (user.Role === "Admin") {
      return '<span class="text-muted">Already Admin</span>';
    }

    return `
    <button class="btn btn-primary promote-btn" data-username="${user.Username}">
      Promote to Admin
    </button>
  `;
  }

  updateStats() {
    const totalUsers = this.users.length;
    const totalAdmins = this.users.filter(
      (user) => user.Role === "Admin"
    ).length;
    const totalAuthors = this.users.filter(
      (user) => user.Role === "Author"
    ).length;

    document.getElementById("totalUsers").textContent = totalUsers;
    document.getElementById("totalAdmins").textContent = totalAdmins;
    document.getElementById("totalAuthors").textContent = totalAuthors;
  }

  showPromoteModal(username) {
    this.selectedUser = username;
    document.getElementById(
      "confirmMessage"
    ).textContent = `Are you sure you want to promote "${username}" to admin? This action cannot be undone.`;
    document.getElementById("confirmModal").style.display = "block";
  }

  closeModal() {
    document.getElementById("confirmModal").style.display = "none";
    this.selectedUser = null;
  }

  async confirmPromotion() {
    if (!this.selectedUser) return;

    try {
      const token = localStorage.getItem("jwtToken");
      const response = await fetch(
        `/api/admin/users/promote/${this.selectedUser}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to promote user");
      }

      this.showSuccess(data.message);
      this.closeModal();

      // Reload users to reflect changes
      await this.loadUsers();
    } catch (error) {
      console.error("Error promoting user:", error);
      this.showError(
        error.message || "Failed to promote user. Please try again."
      );
      this.closeModal();
    }
  }

  showLoading() {
    document.getElementById("loadingSpinner").style.display = "block";
    document.getElementById("usersContainer").style.display = "none";
    document.getElementById("errorMessage").style.display = "none";
  }

  hideLoading() {
    document.getElementById("loadingSpinner").style.display = "none";
    document.getElementById("usersContainer").style.display = "block";
  }

  showError(message) {
    document.getElementById("loadingSpinner").style.display = "none";
    document.getElementById("usersContainer").style.display = "none";

    const errorElement = document.getElementById("errorMessage");
    errorElement.querySelector("p").textContent = message;
    errorElement.style.display = "block";
  }

  showSuccess(message) {
    // Remove any existing success messages
    const existingSuccess = document.querySelector(".success-message");
    if (existingSuccess) {
      existingSuccess.remove();
    }

    // Create new success message
    const successElement = document.createElement("div");
    successElement.className = "success-message";
    successElement.innerHTML = `<p>${this.escapeHtml(message)}</p>`;

    // Insert before users container
    const container = document.querySelector(".container");
    const usersContainer = document.getElementById("usersContainer");
    container.insertBefore(successElement, usersContainer);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      successElement.remove();
    }, 5000);
  }

  showAccessDenied() {
    document.body.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; height: 100vh; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                <div style="background: white; padding: 3rem; border-radius: 16px; box-shadow: 0 16px 64px rgba(0, 0, 0, 0.2); text-align: center; max-width: 400px;">
                    <h2 style="color: #dc3545; margin-bottom: 1rem;">Access Denied</h2>
                    <p style="color: #666; margin-bottom: 2rem;">You don't have permission to access the admin dashboard. Only administrators can view this page.</p>
                    <a href="/blog" style="background: #007bff; color: white; padding: 0.75rem 1.5rem; text-decoration: none; border-radius: 8px; display: inline-block;">Go to Blog</a>
                </div>
            </div>
        `;
  }

  redirectToLogin() {
    localStorage.removeItem("jwtToken");
    window.location.href = "/login";
  }

  logout() {
    localStorage.removeItem("jwtToken");
    window.location.href = "/login";
  }

  formatDate(dateString) {
    if (!dateString || dateString === "0001-01-01T00:00:00") {
      return "Never";
    }

    const date = new Date(dateString);
    return (
      date.toLocaleDateString() +
      " " +
      date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize admin dashboard when page loads
window.adminDashboard; // Make it globally accessible
document.addEventListener("DOMContentLoaded", () => {
  window.adminDashboard = new AdminDashboard();
});
