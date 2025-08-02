import { showMessage } from "./notifications.js";

/**
 * Custom Error class for HTTP errors to include the response object.
 */
export class HttpError extends Error {
  constructor(message, response) {
    super(message);
    this.name = "HttpError";
    this.response = response;
  }
}

/**
 * A centralized fetch wrapper for making authenticated API calls.
 * It automatically adds the Authorization header and handles session expiration (401).
 * @param {string} url The URL to fetch.
 * @param {RequestInit} options The options for the fetch call.
 * @returns {Promise<Response>} A promise that resolves with the Response object if successful.
 * @throws {HttpError} Throws an HttpError if the fetch fails or the session expires.
 */
export async function authenticatedFetch(url, options = {}) {
  const token = localStorage.getItem("jwtToken");

  // Prepare headers
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.append("Authorization", `Bearer ${token}`);
  }
  // Do not set Content-Type if body is FormData, the browser will do it.
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.append("Content-Type", "application/json");
  }

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    if (response.status === 401) {
      // Handle session expiration
      showMessage("Session expired. Please login again.", "warning");
      localStorage.removeItem("jwtToken");
      localStorage.removeItem("username");
      setTimeout(() => {
        window.location.href = "/login";
      }, 2000);
      throw new HttpError("Session expired", response);
    }
    throw new HttpError(`HTTP error! status: ${response.status}`, response);
  }

  return response;
}
