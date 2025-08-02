import { showMessage } from "./utils/notifications.js";
import { initializeThemeToggle } from "./utils/themeToggle.js";

initializeThemeToggle();
const forgotForm = document.getElementById("forgotForm");
const otpForm = document.getElementById("otpForm");
const resetForm = document.getElementById("resetForm");
const fpMessage = document.getElementById("fpMessage");

let fpUsername = "";
let fpEmail = "";
let otpVerified = false;

forgotForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  fpUsername = document.getElementById("fpUsername").value.trim();
  fpEmail = document.getElementById("fpEmail").value.trim();
  fpMessage.textContent = "";
  try {
    const response = await fetch(
      "https://localhost:7189/api/users/forgot-password",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Username: fpUsername, Email: fpEmail }),
      }
    );
    if (response.ok) {
      fpMessage.textContent = "OTP sent to your email.";
      forgotForm.style.display = "none";
      otpForm.style.display = "block";
    } else {
      const error = await response.json();
      fpMessage.textContent = error.message || "Failed to send OTP.";
    }
  } catch (err) {
    fpMessage.textContent = "Network error: " + err.message;
  }
});

otpForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const otp = document.getElementById("fpOtp").value.trim();
  fpMessage.textContent = "";
  try {
    const response = await fetch(
      "https://localhost:7189/api/users/verify-otp",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Username: fpUsername, OTPCode: otp }),
      }
    );
    if (response.ok) {
      fpMessage.textContent = "OTP verified. Please enter your new password.";
      otpForm.style.display = "none";
      resetForm.style.display = "block";
      otpVerified = true;
    } else {
      const error = await response.json();
      fpMessage.textContent = error.message || "Invalid OTP.";
    }
  } catch (err) {
    fpMessage.textContent = "Network error: " + err.message;
  }
});

resetForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const newPassword = document.getElementById("fpNewPassword").value;
  const confirmPassword = document.getElementById("fpConfirmPassword").value;
  fpMessage.textContent = "";
  if (newPassword !== confirmPassword) {
    fpMessage.textContent = "Passwords do not match.";
    return;
  }
  try {
    const response = await fetch(
      "https://localhost:7189/api/users/reset-password",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Username: fpUsername,
          NewPassword: newPassword,
        }),
      }
    );
    if (response.ok) {
      fpMessage.textContent =
        "Password updated successfully. Redirecting to login...";
      setTimeout(() => {
        window.location.href = "login.html";
      }, 1500);
    } else {
      const error = await response.json();
      fpMessage.textContent = error.message || "Failed to update password.";
    }
  } catch (err) {
    fpMessage.textContent = "Network error: " + err.message;
  }
});
