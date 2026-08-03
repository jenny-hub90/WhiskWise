document.addEventListener("DOMContentLoaded", async () => {
  const grid = document.getElementById("recipeGrid");

  await loadRecipes();

  async function loadRecipes() {
    try {
      const res = await fetch("/api/recipes");
      const data = await res.json();

      if (!data.success || data.recipes.length === 0) {
        grid.innerHTML =
          '<p class="empty-state">No recipes yet — add your first one!</p>';
        return;
      }

      grid.innerHTML = ""; // clear old cards before re-rendering

      data.recipes.forEach((recipe) => {
        const card = document.createElement("article");
        card.className = "recipe-card";

        const metaParts = [];
        if (recipe.prep_time) metaParts.push(`${recipe.prep_time} min`);
        if (recipe.servings) metaParts.push(`${recipe.servings} servings`);

        const imageBlock = recipe.image_url
          ? `<img src="${recipe.image_url}" alt="" loading="lazy" />`
          : `<div class="img-fallback"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 3v18M20 3v18M4 8h4a4 4 0 0 0 0-5H4z" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;

        // NOTE: edit-btn / delete-btn live INSIDE .recipe-card-body,
        // so they render inside the card, not below the whole grid.
        card.innerHTML = `
          ${imageBlock}
          <div class="recipe-card-body">
            <span class="recipe-tag">${recipe.category}</span>
            <h3>${recipe.name}</h3>
            <p class="recipe-meta">${metaParts.join(" · ") || "&nbsp;"}</p>
            <div class="card-actions">
              <button type="button" class="edit-btn" data-id="${recipe.id}">Edit</button>
              <button type="button" class="delete-btn" data-id="${recipe.id}">Delete</button>
            </div>
          </div>
          <div class="recipe-detail">
            <h4>Ingredients</h4>
            <ul>${recipe.ingredients.map((i) => `<li>${i}</li>`).join("")}</ul>
            <h4>Instructions</h4>
            <ol>${recipe.instructions.map((s) => `<li>${s}</li>`).join("")}</ol>
          </div>
        `;

        card.addEventListener("click", () => card.classList.toggle("is-open"));
        grid.appendChild(card);
      });
    } catch (err) {
      grid.innerHTML =
        '<p class="empty-state">Could not reach the server. Is it running?</p>';
    }
  }

  // One listener on the grid handles clicks for every card's buttons,
  // including cards added later by loadRecipes().
  grid.addEventListener("click", async (e) => {
    const deleteBtn = e.target.closest(".delete-btn");
    const editBtn = e.target.closest(".edit-btn");

    if (deleteBtn || editBtn) e.stopPropagation();

    if (deleteBtn) {
      const id = deleteBtn.dataset.id;
      const confirmed = confirm("Delete this recipe? This can't be undone.");
      if (!confirmed) return;

      try {
        const res = await fetch(`/api/recipes/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
          await loadRecipes();
        } else {
          alert(data.message || "Could not delete recipe.");
        }
      } catch (err) {
        alert("Could not reach the server.");
      }
    }

    if (editBtn) {
      const id = editBtn.dataset.id;
      window.location.href = `add-recipe.html?id=${id}`;
    }
  });
});
