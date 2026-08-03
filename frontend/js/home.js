document.addEventListener('DOMContentLoaded', async () => {
  const welcomeMessage = document.getElementById('welcomeMessage');
  const greetingEyebrow = document.getElementById('greetingEyebrow');
  const statsRow = document.getElementById('statsRow');
  const recentSection = document.getElementById('recentSection');
  const recentGrid = document.getElementById('recentGrid');

  document.getElementById('logoutLink').addEventListener('click', async (e) => {
    e.preventDefault();
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = 'login.html';
  });

  // --- Auth check (server-verified, not sessionStorage) ---
  let me;
  try {
    const res = await fetch('/api/me');
    if (!res.ok) {
      window.location.href = 'login.html';
      return;
    }
    me = await res.json();
  } catch (err) {
    window.location.href = 'login.html';
    return;
  }

  welcomeMessage.textContent = `Welcome, ${me.name}!`;
  document.getElementById('year').textContent = new Date().getFullYear();
  greetingEyebrow.textContent = timeGreeting();

  if (me.role === 'admin') {
    const navLinks = document.querySelector('.nav-links');
    const logoutLink = document.getElementById('logoutLink');
    const adminLink = document.createElement('a');
    adminLink.href = 'admin.html';
    adminLink.textContent = 'Admin';
    navLinks.insertBefore(adminLink, logoutLink);
  }

  // --- Quick-glance stats + recently added, from the person's own recipes ---
  try {
    const res = await fetch('/api/recipes');
    if (!res.ok) return; // stats are a bonus, not worth blocking the page over
    const data = await res.json();
    if (!data.success) return;

    renderStats(data.recipes);
    renderRecent(data.recipes.slice(0, 3));
  } catch (err) {
    // Quietly skip stats/recent if the recipes fetch fails — home page
    // still works fine without them.
  }

  function timeGreeting() {
    const hour = new Date().getHours();
    if (hour < 5) return "Late-night snack run?";
    if (hour < 12) return "Good morning — kettle's on";
    if (hour < 17) return "Good afternoon — lunch is calling";
    if (hour < 21) return "Good evening — dinner o'clock";
    return "Good evening — one more before bed?";
  }

  function renderStats(recipes) {
    const total = recipes.length;
    const categories = new Set(recipes.map((r) => r.category)).size;
    const lastAdded = recipes[0]
      ? new Date(recipes[0].created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : '—';

    statsRow.innerHTML = `
      <div class="stat-chip">
        <span class="stat-number">${total}</span>
        <span class="stat-label">${total === 1 ? 'Recipe saved' : 'Recipes saved'}</span>
      </div>
      <div class="stat-chip">
        <span class="stat-number">${categories}</span>
        <span class="stat-label">${categories === 1 ? 'Category' : 'Categories'}</span>
      </div>
      <div class="stat-chip">
        <span class="stat-number">${lastAdded}</span>
        <span class="stat-label">Last added</span>
      </div>
    `;
  }

  function renderRecent(recipes) {
    if (recipes.length === 0) return; // keep the section hidden — nothing to show yet

    recentSection.style.display = 'block';
    recentGrid.innerHTML = recipes.map((recipe) => {
      const imageBlock = recipe.image_url
        ? `<img src="${recipe.image_url}" alt="" loading="lazy" />`
        : `<div class="recent-img-fallback"></div>`;
      return `
        <a class="recent-card" href="recipes.html">
          ${imageBlock}
          <div class="recent-card-body">
            <span class="recipe-tag">${recipe.category}</span>
            <h3>${recipe.name}</h3>
          </div>
        </a>
      `;
    }).join('');
  }
});