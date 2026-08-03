document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("signupForm");
  const messageBox = document.getElementById("message");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    messageBox.textContent = "";

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const agree = document.getElementById("agree").checked;

    if (!name || !email || !password || !confirmPassword) {
      showMessage("Please fill in all fields.", "error");
      return;
    }
    if (password !== confirmPassword) {
      showMessage("Passwords do not match.", "error");
      return;
    }
    if (!agree) {
      showMessage("Please agree to the terms to continue.", "error");
      return;
    }

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();

      if (data.success) {
        showMessage(data.message, "success");
        sessionStorage.setItem("userName", name);
        form.reset();
        setTimeout(() => {
          window.location.href = "home.html";
        }, 1000);
      } else {
        showMessage(data.message, "error");
      }
    } catch (err) {
      showMessage("Could not reach the server. Is it running?", "error");
    }
  });

  function showMessage(text, type) {
    messageBox.textContent = text;
    messageBox.style.color = type === "error" ? "#D6304A" : "#1C8A4B";
  }
});
