document.addEventListener("DOMContentLoaded", async function () {
  const page = document.body.dataset.page;

  const toggleButtons = document.querySelectorAll(".toggle-password");
  toggleButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      const targetId = button.getAttribute("data-target");
      const input = document.getElementById(targetId);

      if (!input) return;

      if (input.type === "password") {
        input.type = "text";
        button.textContent = "Hide";
      } else {
        input.type = "password";
        button.textContent = "Show";
      }
    });
  });

  function setMessage(elementId, text, type) {
    const messageBox = document.getElementById(elementId);

    if (!messageBox) return;

    messageBox.textContent = text;
    messageBox.className = "form-message " + type;
  }

  function isValidEmail(email) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(email);
  }

  async function getCsrfToken() {
    try {
      const response = await fetch("/api/auth/csrf-token", { credentials: "same-origin" });
      const data = await response.json();
      return data.csrfToken || "";
    } catch (error) {
      return "";
    }
  }

  function setLoadingState(button, text, isLoading) {
    if (!button) return;
    button.disabled = isLoading;
    button.textContent = text;
  }

  async function checkSession() {
    try {
      const response = await fetch("/api/auth/session", { credentials: "same-origin" });
      if (!response.ok) return null;

      const data = await response.json();
      return data.user || null;
    } catch (error) {
      return null;
    }
  }

  async function updateNavigation(user) {
    const nav = document.querySelector(".main-nav");
    if (!nav) return;

    const loginLink = Array.from(nav.querySelectorAll("a")).find((link) => link.getAttribute("href") === "login.html");
    const signupLink = Array.from(nav.querySelectorAll("a")).find((link) => link.getAttribute("href") === "signup.html");

    if (!user) {
      if (loginLink) loginLink.style.display = "inline";
      if (signupLink) signupLink.style.display = "inline";
      return;
    }

    if (loginLink) {
      loginLink.textContent = "My Account";
      loginLink.href = "#";
      loginLink.addEventListener("click", function (event) {
        event.preventDefault();
      });
    }

    if (signupLink) {
      signupLink.textContent = "Logout";
      signupLink.href = "#";
      signupLink.addEventListener("click", async function (event) {
        event.preventDefault();
        const csrfToken = await getCsrfToken();
        const logoutResponse = await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
          },
        });

        if (logoutResponse.ok) {
          window.location.href = "index.html";
          return;
        }

        const logoutData = await logoutResponse.json().catch(() => ({}));
        setMessage("login-message", logoutData.message || "Logout failed. Please try again.", "error");
      });
    }
  }

  if (page === "home") {
    const user = await checkSession();
    await updateNavigation(user);
  }

  if (page === "login") {
    const user = await checkSession();
    if (user) {
      window.location.href = "index.html";
      return;
    }

    const loginForm = document.getElementById("loginForm");

    if (loginForm) {
      loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const email = document.getElementById("login-email").value.trim();
        const password = document.getElementById("login-password").value.trim();
        const submitButton = loginForm.querySelector("button[type='submit']");

        if (!email && !password) {
          setMessage("login-message", "Please enter your email and password.", "error");
          return;
        }

        if (!email) {
          setMessage("login-message", "Email address is required.", "error");
          return;
        }

        if (!isValidEmail(email)) {
          setMessage("login-message", "Please enter a valid email address.", "error");
          return;
        }

        if (!password) {
          setMessage("login-message", "Password is required.", "error");
          return;
        }

        const csrfToken = await getCsrfToken();
        setLoadingState(submitButton, "Logging in...", true);

        try {
          const response = await fetch("/api/auth/login", {
            method: "POST",
            credentials: "same-origin",
            headers: {
              "Content-Type": "application/json",
              "X-CSRF-Token": csrfToken,
            },
            body: JSON.stringify({ email, password }),
          });

          const data = await response.json();

          if (!response.ok) {
            setMessage("login-message", data.message || "Login failed.", "error");
            setLoadingState(submitButton, "Login", false);
            return;
          }

          setMessage("login-message", data.message || "Login successful.", "success");
          setLoadingState(submitButton, "Login", false);
          window.location.href = "index.html";
        } catch (error) {
          setMessage("login-message", "Unable to connect to the server right now.", "error");
          setLoadingState(submitButton, "Login", false);
        }
      });
    }
  }

  if (page === "signup") {
    const user = await checkSession();
    if (user) {
      window.location.href = "index.html";
      return;
    }

    const signupForm = document.getElementById("signupForm");

    if (signupForm) {
      signupForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const fullName = document.getElementById("signup-name").value.trim();
        const email = document.getElementById("signup-email").value.trim();
        const password = document.getElementById("signup-password").value;
        const confirmPassword = document.getElementById("signup-confirm-password").value;
        const userType = document.getElementById("user-type").value;
        const submitButton = signupForm.querySelector("button[type='submit']");

        if (!fullName || !email || !password || !confirmPassword || !userType) {
          setMessage("signup-message", "Please complete all required fields.", "error");
          return;
        }

        if (!isValidEmail(email)) {
          setMessage("signup-message", "Please enter a valid email address.", "error");
          return;
        }

        if (password.length < 8) {
          setMessage("signup-message", "Password must be at least 8 characters long.", "error");
          return;
        }

        if (password !== confirmPassword) {
          setMessage("signup-message", "Passwords do not match. Please try again.", "error");
          return;
        }

        const csrfToken = await getCsrfToken();
        setLoadingState(submitButton, "Creating account...", true);

        try {
          const response = await fetch("/api/auth/register", {
            method: "POST",
            credentials: "same-origin",
            headers: {
              "Content-Type": "application/json",
              "X-CSRF-Token": csrfToken,
            },
            body: JSON.stringify({
              name: fullName,
              email,
              password,
              role: "user",
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            setMessage("signup-message", data.message || "Registration failed.", "error");
            setLoadingState(submitButton, "Sign Up", false);
            return;
          }

          setMessage("signup-message", data.message || "Registration successful.", "success");
          setLoadingState(submitButton, "Sign Up", false);
          signupForm.reset();
        } catch (error) {
          setMessage("signup-message", "Unable to connect to the server right now.", "error");
          setLoadingState(submitButton, "Sign Up", false);
        }
      });
    }
  }
});
