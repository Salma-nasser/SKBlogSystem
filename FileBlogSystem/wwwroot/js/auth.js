// === REGISTER password handling ===
const registerPasswordInput = document.getElementById("registerPassword");
const toggleRegisterPassword = document.getElementById("togglePassword");
const passwordRules = document.getElementById("passwordRules");

if (registerPasswordInput && toggleRegisterPassword && passwordRules) {
  registerPasswordInput.addEventListener("input", () => {
    const value = registerPasswordInput.value;

    // Validation rules
    const isLongEnough = value.length >= 8;
    const hasUppercase = /[A-Z]/.test(value);
    const hasSpecialChar = /[^A-Za-z0-9]/.test(value);

    // Update rule indicators
    document.getElementById("ruleLength").textContent =
      (isLongEnough ? "✅" : "❌") + " At least 8 characters";
    document.getElementById("ruleUpper").textContent =
      (hasUppercase ? "✅" : "❌") + " At least one uppercase letter";
    document.getElementById("ruleSpecial").textContent =
      (hasSpecialChar ? "✅" : "❌") +
      " At least one special character (!@#$...)";

    // Show/hide eye and rules
    const hasInput = value.length > 0;
    toggleRegisterPassword.style.display = hasInput ? "inline" : "none";
    passwordRules.style.display = hasInput ? "block" : "none";
  });

  toggleRegisterPassword.addEventListener("click", () => {
    const isHidden = registerPasswordInput.type === "password";
    registerPasswordInput.type = isHidden ? "text" : "password";
    toggleRegisterPassword.textContent = isHidden ? "🙈" : "👁️";
  });
}

// === REGISTER form submission ===
const registerForm = document.getElementById("RegisterForm");

if (registerForm) {
  registerForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const username = document.getElementById("username").value;
    const password = registerPasswordInput.value;

    try {
      const response = await fetch("http://localhost:5000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Username: username,
          Email: email,
          Password: password,
        }),
      });

      if (response.ok) {
        window.location.href = `welcome.html?username=${encodeURIComponent(
          username
        )}`;
      } else {
        const error = await response.json();
        document.getElementById("errorMessage").innerText =
          "Error: " + error.message;
        document.getElementById("errorMessage").style.display = "block";
      }
    } catch (err) {
      document.getElementById("errorMessage").innerText =
        "Something went wrong: " + err.message;
      document.getElementById("errorMessage").style.display = "block";
    }
  });
}

// === LOGIN password handling ===
const loginPasswordInput = document.getElementById("loginPassword");
const toggleLoginPassword = document.getElementById("toggleLoginPassword");

if (loginPasswordInput && toggleLoginPassword) {
  // Toggle visibility
  toggleLoginPassword.addEventListener("click", () => {
    const isHidden = loginPasswordInput.type === "password";
    loginPasswordInput.type = isHidden ? "text" : "password";
    toggleLoginPassword.textContent = isHidden ? "🙈" : "👁️";
  });

  // Show/hide icon only when typing
  loginPasswordInput.addEventListener("input", () => {
    toggleLoginPassword.style.display =
      loginPasswordInput.value.length > 0 ? "inline" : "none";
  });
}

// === LOGIN form submission ===
const loginForm = document.getElementById("LoginForm");

if (loginForm) {
  loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const username = document.getElementById("username").value;
    const password = loginPasswordInput.value;

    try {
      const response = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Username: username, Password: password }),
      })
        .then((res) => res.json())
        .then((data) => {
          localStorage.setItem("jwtToken", data.token); // Store securely
          window.location.href = `blog.html?username=${encodeURIComponent(
            username
          )}`; // Redirect to blog page
        });

      // if (response.ok) {
      //   window.location.href = `welcome.html?username=${encodeURIComponent(
      //     username
      //   )}`;
      // } else {
      //   const error = await response.json();
      //   alert("Login failed: " + error.message);
      // }
    } catch (err) {
      alert("Something went wrong: " + err.message);
    }
  });
}
