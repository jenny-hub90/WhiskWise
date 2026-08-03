document.addEventListener('DOMContentLoaded', async () => {
  const accessDenied = document.getElementById('accessDenied');
  const dashboardContent = document.getElementById('dashboardContent');

  document.getElementById('logoutLink').addEventListener('click', async (e) => {
    e.preventDefault();
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = 'login.html';
  });

  // Not logged in at all → straight to login, nothing to show here.
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

  // Logged in, but not an admin → show a clear "not authorized" message
  // instead of silently redirecting, so it's obvious *why* they can't get in.
  if (me.role !== 'admin') {
    accessDenied.style.display = 'block';
    return;
  }

  dashboardContent.style.display = 'block';
  document.getElementById('year').textContent = new Date().getFullYear();

  await Promise.all([loadUsers(), loadRecipes()]);

  async function loadUsers() {
    const usersBody = document.getElementById('usersBody');
    try {
      const res = await fetch('/api/admin/users');
      if (res.status === 401) { window.location.href = 'login.html'; return; }
      if (res.status === 403) {
        accessDenied.style.display = 'block';
        dashboardContent.style.display = 'none';
        return;
      }

      const data = await res.json();
      if (!data.success || data.users.length === 0) {
        usersBody.innerHTML = '<tr><td colspan="4" class="empty-state">No users yet.</td></tr>';
        return;
      }

      usersBody.innerHTML = data.users.map((u) => `
        <tr>
          <td>${u.name}</td>
          <td>${u.email}</td>
          <td><span class="role-tag role-${u.role}">${u.role}</span></td>
          <td>${new Date(u.created_at).toLocaleDateString()}</td>
        </tr>
      `).join('');
    } catch (err) {
      usersBody.innerHTML = '<tr><td colspan="4" class="empty-state">Could not load users.</td></tr>';
    }
  }

  async function loadRecipes() {
    const recipesBody = document.getElementById('recipesBody');
    try {
      const res = await fetch('/api/admin/recipes');
      if (res.status === 401) { window.location.href = 'login.html'; return; }
      if (res.status === 403) {
        accessDenied.style.display = 'block';
        dashboardContent.style.display = 'none';
        return;
      }

      const data = await res.json();
      if (!data.success || data.recipes.length === 0) {
        recipesBody.innerHTML = '<tr><td colspan="4" class="empty-state">No recipes yet.</td></tr>';
        return;
      }

      recipesBody.innerHTML = data.recipes.map((r) => `
        <tr>
          <td>${r.name}</td>
          <td>${r.category}</td>
          <td>${r.created_by_name ? `${r.created_by_name} (${r.created_by_email})` : 'Unknown'}</td>
          <td>${new Date(r.created_at).toLocaleDateString()}</td>
        </tr>
      `).join('');
    } catch (err) {
      recipesBody.innerHTML = '<tr><td colspan="4" class="empty-state">Could not load recipes.</td></tr>';
    }
  }
});