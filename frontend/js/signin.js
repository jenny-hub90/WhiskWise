document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const messageBox = document.getElementById("message");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    messageBox.textContent = "";

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (!email || !password) {
      showMessage("Please fill in both fields.", "error");
      return;
    }

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (data.success) {
        showMessage(data.message, "success");
        sessionStorage.setItem("userName", data.name);
        form.reset();
        setTimeout(() => {
          window.location.href = "home.html";
        }, 800);
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
