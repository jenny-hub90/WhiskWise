require('dotenv').config();
const path = require('path');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { ready, get, all, run } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'whiskwise-dev-secret-change-me';
const TOKEN_EXPIRY = '1d';

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../frontend')));

// Make sure tables exist / migrations have run before any request touches the DB.
app.use(async (req, res, next) => {
  try {
    await ready;
    next();
  } catch (err) {
    console.error('DB not ready:', err);
    res.status(503).json({ success: false, message: 'Database is not available right now.' });
  }
});

// ================= AUTH HELPERS =================

function signToken(user) {
  return jwt.sign({ id: user.id, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

function requireAuth(req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ success: false, message: 'Please log in to continue.' });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Session expired, please log in again.' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admins only.' });
  }
  next();
}

app.get('/', (req, res) => res.redirect('/signup.html'));

// ================= AUTH ROUTES =================

app.post('/api/signup', async (req, res) => {
  const { name, email, password, adminCode } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }
  try {
    const existing = await get('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(409).json({ success: false, message: 'That email is already registered.' });
    }

    const isAdmin = Boolean(process.env.ADMIN_INVITE_CODE) && adminCode === process.env.ADMIN_INVITE_CODE;
    const role = isAdmin ? 'admin' : 'user';

    const hashedPassword = bcrypt.hashSync(password, 10);
    await run(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, role]
    );

    console.log(`✅ New user saved to database: ${email} (role: ${role})`);

    return res.json({ success: true, message: 'Account created!' });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }
  try {
    const user = await get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    const passwordMatches = bcrypt.compareSync(password, user.password);
    if (!passwordMatches) return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    const token = signToken(user);
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24
    });

    console.log(`✅ User logged in: ${user.email} (role: ${user.role})`);

    return res.json({ success: true, message: `Welcome back, ${user.name}!`, name: user.name, role: user.role });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
});

app.get('/api/me', requireAuth, (req, res) => {
  return res.json({ success: true, name: req.user.name, role: req.user.role });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  return res.json({ success: true, message: 'Logged out.' });
});

// ================= RECIPES (any logged-in user) =================

app.post('/api/recipes', requireAuth, async (req, res) => {
  const { name, category, prepTime, servings, ingredients, instructions, imageUrl } = req.body;

  if (!name || !category || !ingredients || !ingredients.length || !instructions || !instructions.length) {
    return res.status(400).json({ success: false, message: 'Name, category, ingredients, and instructions are required.' });
  }

  try {
    const result = await run(
      `INSERT INTO recipes (user_id, name, category, prep_time, servings, ingredients, instructions, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        name,
        category,
        prepTime || null,
        servings || null,
        JSON.stringify(ingredients),
        JSON.stringify(instructions),
        imageUrl || null
      ]
    );

    console.log(`✅ New recipe saved: ${name} (by user ${req.user.id})`);

    return res.json({ success: true, message: 'Recipe saved!', id: result.lastInsertRowid });
  } catch (err) {
    console.error('Create recipe error:', err);
    return res.status(500).json({ success: false, message: 'Something went wrong saving the recipe.' });
  }
});

app.get('/api/recipes', requireAuth, async (req, res) => {
  try {
    const rows = await all('SELECT * FROM recipes ORDER BY created_at DESC');
    const recipes = rows.map((row) => ({
      ...row,
      ingredients: JSON.parse(row.ingredients),
      instructions: JSON.parse(row.instructions)
    }));
    return res.json({ success: true, recipes });
  } catch (err) {
    console.error('List recipes error:', err);
    return res.status(500).json({ success: false, message: 'Something went wrong loading recipes.' });
  }
});

app.get('/api/recipes/:id', requireAuth, async (req, res) => {
  try {
    const row = await get('SELECT * FROM recipes WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ success: false, message: 'Recipe not found.' });
    return res.json({
      success: true,
      recipe: { ...row, ingredients: JSON.parse(row.ingredients), instructions: JSON.parse(row.instructions) }
    });
  } catch (err) {
    console.error('Get recipe error:', err);
    return res.status(500).json({ success: false, message: 'Something went wrong loading the recipe.' });
  }
});

app.put('/api/recipes/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { name, category, prepTime, servings, ingredients, instructions, imageUrl } = req.body;

  if (!name || !category || !ingredients || !ingredients.length || !instructions || !instructions.length) {
    return res.status(400).json({ success: false, message: 'Name, category, ingredients, and instructions are required.' });
  }

  try {
    const existing = await get('SELECT id FROM recipes WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Recipe not found.' });

    await run(
      `UPDATE recipes
       SET name = ?, category = ?, prep_time = ?, servings = ?, ingredients = ?, instructions = ?, image_url = ?
       WHERE id = ?`,
      [
        name,
        category,
        prepTime || null,
        servings || null,
        JSON.stringify(ingredients),
        JSON.stringify(instructions),
        imageUrl || null,
        id
      ]
    );

    console.log(`✅ Recipe updated: ${name} (id ${id})`);

    return res.json({ success: true, message: 'Recipe updated!' });
  } catch (err) {
    console.error('Update recipe error:', err);
    return res.status(500).json({ success: false, message: 'Something went wrong updating the recipe.' });
  }
});

app.delete('/api/recipes/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await get('SELECT id, name FROM recipes WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Recipe not found.' });

    await run('DELETE FROM recipes WHERE id = ?', [id]);

    console.log(`🗑️ Recipe deleted: ${existing.name} (id ${id})`);

    return res.json({ success: true, message: 'Recipe deleted.' });
  } catch (err) {
    console.error('Delete recipe error:', err);
    return res.status(500).json({ success: false, message: 'Something went wrong deleting the recipe.' });
  }
});

// ================= ADMIN (requireAuth + requireAdmin) =================

app.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await all('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC');
    return res.json({ success: true, users });
  } catch (err) {
    console.error('Admin list users error:', err);
    return res.status(500).json({ success: false, message: 'Something went wrong loading users.' });
  }
});

app.get('/api/admin/recipes', requireAuth, requireAdmin, async (req, res) => {
  try {
    const rows = await all(`
      SELECT recipes.*, users.name AS created_by_name, users.email AS created_by_email
      FROM recipes
      LEFT JOIN users ON recipes.user_id = users.id
      ORDER BY recipes.created_at DESC
    `);
    const recipes = rows.map((row) => ({
      ...row,
      ingredients: JSON.parse(row.ingredients),
      instructions: JSON.parse(row.instructions)
    }));
    return res.json({ success: true, recipes });
  } catch (err) {
    console.error('Admin list recipes error:', err);
    return res.status(500).json({ success: false, message: 'Something went wrong loading recipes.' });
  }
});

// Only actually bind to a port when run directly (local dev / non-Vercel host).
// On Vercel, this file is imported as a serverless function handler instead.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

module.exports = app;