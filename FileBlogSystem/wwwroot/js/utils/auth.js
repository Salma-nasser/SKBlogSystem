// Authentication utility functions

class AuthUtils {
  static getToken() {
    return localStorage.getItem("jwtToken");
  }

  static setToken(token) {
    localStorage.setItem("jwtToken", token);
  }

  static removeToken() {
    localStorage.removeItem("jwtToken");
  }

  static isLoggedIn() {
    return !!this.getToken();
  }

  static async makeAuthenticatedRequest(url, options = {}) {
    const token = this.getToken();

    if (!token) {
      throw new Error("No authentication token found");
    }

    const defaultHeaders = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const requestOptions = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    const response = await fetch(url, requestOptions);

    if (response.status === 401) {
      this.removeToken();
      window.location.href = "/";
      throw new Error("Authentication failed");
    }

    return response;
  }

  static logout() {
    this.removeToken();
    window.location.href = "/login";
  }

  static parseJwt(token) {
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
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error("Error parsing JWT:", error);
      return null;
    }
  }

  static getUserRole() {
    const token = this.getToken();
    if (!token) return null;

    const payload = this.parseJwt(token);
    if (!payload) return null;
    // Support both standard and schema-qualified role claims
    return (
      payload.role ||
      payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] ||
      null
    );
  }

  static isAdmin() {
    return this.getUserRole() === "Admin";
  }

  static getUsername() {
    const token = this.getToken();
    if (!token) return null;

    const payload = this.parseJwt(token);
    return payload?.unique_name || null;
  }
}

// Make AuthUtils available globally
window.AuthUtils = AuthUtils;
