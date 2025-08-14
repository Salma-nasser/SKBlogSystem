import { showMessage } from "./utils/notifications.js";
import { initializeThemeToggle } from "./utils/themeToggle.js";
import { initMobileSidebar } from "./utils/mobileSidebar.js";

initializeThemeToggle();
initMobileSidebar();
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
    const response = await fetch("/api/users/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Username: fpUsername, Email: fpEmail }),
    });
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
    const response = await fetch("/api/users/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Username: fpUsername, OTPCode: otp }),
    });
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
    const response = await fetch("/api/users/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        Username: fpUsername,
        NewPassword: newPassword,
      }),
    });
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

// Toggle password visibility for forgot password reset inputs
const toggleIcons = document.querySelectorAll(
  "#togglePassword, #toggleConfirmPassword"
);
toggleIcons.forEach((icon) => {
  const pwdInput = icon.previousElementSibling;
  icon.addEventListener("click", () => {
    if (pwdInput.type === "password") {
      pwdInput.type = "text";
      icon.textContent = "🙈";
    } else {
      pwdInput.type = "password";
      icon.textContent = "👁️";
    }
  });
});

// Password rules validation for new password
const newPwdInput = document.getElementById("fpNewPassword");
const pwdRulesList = document.getElementById("passwordRules");
const ruleLength = document.getElementById("ruleLength");
const ruleUpper = document.getElementById("ruleUpper");
const ruleSpecial = document.getElementById("ruleSpecial");

if (newPwdInput) {
  newPwdInput.addEventListener("input", () => {
    const val = newPwdInput.value;
    // Show rules list
    pwdRulesList.style.display = "block";
    // Length rule
    if (val.length >= 8) {
      ruleLength.classList.add("password-valid");
      ruleLength.classList.remove("password-invalid");
      ruleLength.innerHTML = "✔️ At least 8 characters";
    } else {
      ruleLength.classList.add("password-invalid");
      ruleLength.classList.remove("password-valid");
      ruleLength.innerHTML = "❌ At least 8 characters";
    }
    // Uppercase rule
    if (/[A-Z]/.test(val)) {
      ruleUpper.classList.add("password-valid");
      ruleUpper.classList.remove("password-invalid");
      ruleUpper.innerHTML = "✔️ Contains uppercase letter";
    } else {
      ruleUpper.classList.add("password-invalid");
      ruleUpper.classList.remove("password-valid");
      ruleUpper.innerHTML = "❌ Contains uppercase letter";
    }
    // Special character rule
    if (/[^A-Za-z0-9]/.test(val)) {
      ruleSpecial.classList.add("password-valid");
      ruleSpecial.classList.remove("password-invalid");
      ruleSpecial.innerHTML = "✔️ Contains special character";
    } else {
      ruleSpecial.classList.add("password-invalid");
      ruleSpecial.classList.remove("password-valid");
      ruleSpecial.innerHTML = "❌ Contains special character";
    }
  });
}
