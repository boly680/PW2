document.addEventListener("DOMContentLoaded", function () {
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

  if (page === "login") {
    const loginForm = document.getElementById("loginForm");

    if (loginForm) {
      loginForm.addEventListener("submit", function (event) {
        event.preventDefault();

        const email = document.getElementById("login-email").value.trim();
        const password = document.getElementById("login-password").value.trim();

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

        setMessage(
          "login-message",
          "Login successful. This is a frontend-only demo for the Manuscripts Auction Store.",
          "success"
        );
        loginForm.reset();
      });
    }
  }

  if (page === "signup") {
    const signupForm = document.getElementById("signupForm");

    if (signupForm) {
      signupForm.addEventListener("submit", function (event) {
        event.preventDefault();

        const fullName = document.getElementById("signup-name").value.trim();
        const email = document.getElementById("signup-email").value.trim();
        const password = document.getElementById("signup-password").value;
        const confirmPassword = document.getElementById("signup-confirm-password").value;
        const userType = document.getElementById("user-type").value;

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

        setMessage(
          "signup-message",
          "Sign up successful. This is a frontend-only demo and does not create a real account.",
          "success"
        );
        signupForm.reset();
      });
    }
  }
});
