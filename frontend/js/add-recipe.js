document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('recipeForm');
  const messageBox = document.getElementById('message');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    messageBox.textContent = '';

    const name = document.getElementById('name').value.trim();
    const category = document.getElementById('category').value;
    const prepTime = document.getElementById('prepTime').value;
    const servings = document.getElementById('servings').value;
    const imageUrl = document.getElementById('imageUrl').value.trim();

    const ingredients = document.getElementById('ingredients').value
      .split('\n').map((line) => line.trim()).filter(Boolean);
    const instructions = document.getElementById('instructions').value
      .split('\n').map((line) => line.trim()).filter(Boolean);

    if (!name || !category || ingredients.length === 0 || instructions.length === 0) {
      return showMessage('Please fill in the name, category, at least one ingredient, and at least one step.', 'error');
    }

    try {
      const res = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          category,
          prepTime: prepTime ? Number(prepTime) : null,
          servings: servings ? Number(servings) : null,
          imageUrl: imageUrl || null,
          ingredients,
          instructions
        })
      });
      const data = await res.json();

      if (data.success) {
        showMessage(data.message, 'success');
        form.reset();
        setTimeout(() => { window.location.href = 'recipes.html'; }, 1000);
      } else {
        showMessage(data.message, 'error');
      }
    } catch (err) {
      showMessage('Could not reach the server. Is it running?', 'error');
    }
  });

  function showMessage(text, type) {
    messageBox.textContent = text;
    messageBox.style.color = type === 'error' ? '#D6304A' : '#1C8A4B';
  }
});
