/**
 * database.js — Dual-Mode Database Connection Layer
 *
 * Attempts Supabase PostgreSQL first. If the connection fails (network offline,
 * Supabase paused, DNS failure, etc.), it automatically falls back to a local
 * SQLite database file so the server starts and operates fully offline.
 */

const path = require('path');
const fs   = require('fs');
const { Pool, types } = require('pg');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Override TIMESTAMP parsing to return raw strings (avoids IST timezone shift)
types.setTypeParser(1114, (val) => val);

let useLocalSQLite = false;
let sqliteDb       = null;
let supabaseClient = null;
let supabaseConnected = false;
let postgresConnected = false;

// ── PostgreSQL pool (Supabase) ────────────────────────────────────────────────
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 8000,   // fail fast — don't block startup for 30 s
  idleTimeoutMillis:       10000,
  max:                     5,
});

pgPool.on('error', (err) => {
  if (!useLocalSQLite) {
    console.warn('⚠️  PostgreSQL pool error (will use SQLite fallback):', err.message);
  }
});

// ── SQLite fallback ───────────────────────────────────────────────────────────
function getSQLiteDb() {
  if (sqliteDb) return sqliteDb;
  let Database;
  try { Database = require('better-sqlite3'); }
  catch { Database = require(path.join(__dirname, 'node_modules', 'better-sqlite3')); }

  const dbPath = path.join(__dirname, 'local_ecotrack.db');
  sqliteDb = new Database(dbPath);
  sqliteDb.pragma('journal_mode = WAL');
  sqliteDb.pragma('foreign_keys = ON');
  console.log(`📂 SQLite fallback database: ${dbPath}`);
  return sqliteDb;
}

/**
 * SQLite shim that matches the pg `pool.query(text, params)` signature
 * so the rest of the code doesn't need to change.
 *
 * Handles:
 *  - Multi-statement SQL (splits on semicolons, runs each separately)
 *  - SERIAL → INTEGER PRIMARY KEY (auto-increment)
 *  - Strips REFERENCES ... ON DELETE CASCADE (SQLite uses PRAGMA foreign_keys)
 *  - $1/$2/… → ? placeholder conversion
 */
function sqliteQuery(text, params = []) {
  const db = getSQLiteDb();

  // Convert Postgres placeholder $N back to ? for SQLite
  let sql = text.replace(/\$\d+/g, '?');

  // Convert Postgres-specific DDL syntax → SQLite
  sql = sql
    .replace(/SERIAL PRIMARY KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
    .replace(/TIMESTAMP DEFAULT CURRENT_TIMESTAMP/gi, 'TEXT DEFAULT (datetime(\'now\'))')
    .replace(/TIMESTAMP WITHOUT TIME ZONE/gi, 'TEXT')
    .replace(/REFERENCES \w+\(\w+\)\s*ON DELETE CASCADE/gi, '')
    .replace(/REFERENCES \w+\(\w+\)/gi, '')
    .replace(/md5\(random\(\)::text\)/gi, "lower(hex(randomblob(8)))")
    .replace(/::text/gi, '')
    .replace(/::integer/gi, '');

  // Detect multi-statement blocks (DDL uses ; to separate CREATE TABLE statements)
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 1 && !s.startsWith('--'));

  if (statements.length > 1) {
    // Execute each statement individually (ignore errors for CREATE IF NOT EXISTS / INDEX)
    let lastResult = { rows: [], rowCount: 0 };
    for (const stmt of statements) {
      try {
        const upper = stmt.trim().toUpperCase();
        if (upper.startsWith('SELECT') || upper.startsWith('WITH')) {
          lastResult = { rows: db.prepare(stmt).all(), rowCount: 0 };
        } else {
          const info = db.prepare(stmt).run();
          lastResult = { rows: [], rowCount: info.changes || 0 };
        }
      } catch (e) {
        if (!e.message.includes('already exists') && !e.message.includes('UNIQUE constraint')) {
          console.warn('SQLite multi-stmt warning:', e.message.slice(0, 120));
        }
      }
    }
    return lastResult;
  }

  // Single statement path
  const trimmed = sql.trim().toUpperCase();
  const isSelect = trimmed.startsWith('SELECT') || trimmed.startsWith('WITH');
  const hasReturning = trimmed.includes('RETURNING');

  try {
    if (isSelect || hasReturning) {
      const rows = db.prepare(sql).all(...params);
      return { rows, rowCount: rows.length };
    } else {
      const info = db.prepare(sql).run(...params);
      const lastId = info.lastInsertRowid ? String(info.lastInsertRowid) : null;
      return {
        rows:     lastId ? [{ id: lastId }] : [],
        rowCount: info.changes || 0,
      };
    }
  } catch (err) {
    if (
      err.message.includes('UNIQUE constraint failed') ||
      err.message.includes('no such table')             ||
      err.message.includes('already exists')
    ) {
      return { rows: [], rowCount: 0 };
    }
    throw err;
  }
}

/**
 * Universal query function.
 * Transparently dispatches to Postgres or SQLite depending on availability.
 */
async function query(text, params) {
  if (useLocalSQLite) {
    return sqliteQuery(text, params);
  }
  try {
    return await pgPool.query(text, params);
  } catch (err) {
    const isConnErr =
      err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED' ||
      err.code === 'ETIMEDOUT'  || err.code === 'EAI_AGAIN' ||
      err.message.includes('getaddrinfo') ||
      err.message.includes('timeout') ||
      err.message.includes('Connection terminated') ||
      err.message.includes('connect');

    if (isConnErr) {
      console.warn('⚠️  Supabase unreachable (' + err.message + ') — switching to local SQLite mode permanently.');
      useLocalSQLite = true;
      return sqliteQuery(text, params);
    }
    throw err;
  }
}

/**
 * Test Supabase reachability at startup.
 * Tests official Supabase HTTPS API and PostgreSQL TCP.
 */
async function testConnection() {
  // 1. Test official Supabase Cloud HTTPS API
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    try {
      const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
      const { data, error } = await client.from('events').select('count').limit(1);
      if (!error) {
        supabaseClient = client;
        supabaseConnected = true;
        console.log(`✅ Supabase Cloud connected successfully (${process.env.SUPABASE_URL}).`);
      }
    } catch (sbErr) {
      console.warn('⚠️  Supabase Cloud HTTPS API check:', sbErr.message);
    }
  }

  // 2. Test PostgreSQL direct TCP pool if configured
  if (process.env.DATABASE_URL) {
    try {
      const client = await Promise.race([
        pgPool.connect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout')), 3000)
        ),
      ]);
      client.release();
      postgresConnected = true;
      console.log('✅ Supabase PostgreSQL TCP connection verified.');
      useLocalSQLite = false;
      return;
    } catch (err) {
      postgresConnected = false;
    }
  }

  if (supabaseConnected) {
    useLocalSQLite = true;
    console.log('☁️  Supabase Cloud active & synchronized.');
  } else {
    console.warn('⚠️  Supabase unreachable — falling back to local SQLite.');
    useLocalSQLite = true;
  }
}

module.exports = {
  query,
  pool: {
    // Expose pool-compatible interface so existing code calling pool.query() still works
    query: (text, params) => query(text, params),
    connect: () => pgPool.connect(),
    end: () => pgPool.end(),
    on: (event, cb) => pgPool.on(event, cb),
  },
  testConnection,
  isUsingLocalSQLite: () => useLocalSQLite,
  isSupabaseConnected: () => supabaseConnected,
  getSupabaseClient: () => supabaseClient,
  getSQLiteDb,
};
