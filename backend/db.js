require('dotenv').config();
const { createClient } = require('@libsql/client');

if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  console.warn('⚠️  TURSO_DATABASE_URL / TURSO_AUTH_TOKEN are not set. Set them in .env locally and in Vercel project settings.');
}

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// ---- thin async helpers, shaped like the old better-sqlite3 API ----
// get: returns first row or undefined
// all: returns array of rows
// run: returns { lastInsertRowid, changes }
async function get(sql, args = []) {
  const result = await db.execute({ sql, args });
  return result.rows[0];
}

async function all(sql, args = []) {
  const result = await db.execute({ sql, args });
  return result.rows;
}

async function run(sql, args = []) {
  const result = await db.execute({ sql, args });
  return {
    // Turso returns this as a BigInt, which JSON.stringify can't handle.
    // Convert to a plain Number so it's safe to send back in an API response.
    lastInsertRowid: result.lastInsertRowid !== undefined && result.lastInsertRowid !== null
      ? Number(result.lastInsertRowid)
      : null,
    changes: result.rowsAffected,
  };
}

async function columnExists(table, column) {
  const result = await db.execute(`PRAGMA table_info(${table})`);
  return result.rows.some((c) => c.name === column);
}

async function init() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      prep_time INTEGER,
      servings INTEGER,
      ingredients TEXT NOT NULL,
      instructions TEXT NOT NULL,
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  if (!(await columnExists('users', 'role'))) {
    await db.execute(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'`);
    console.log('🔧 Migrated: added users.role');
  }

  if (!(await columnExists('recipes', 'user_id'))) {
    await db.execute(`ALTER TABLE recipes ADD COLUMN user_id INTEGER`);
    console.log('🔧 Migrated: added recipes.user_id');
  }

  console.log('✅ Database connected successfully (Turso)');
}

// Run once on module load. Routes await `ready` before touching the DB
// so a cold-start request never races the CREATE TABLE statements.
const ready = init().catch((err) => {
  console.error('❌ Database init failed:', err);
  throw err;
});

module.exports = { db, ready, get, all, run };