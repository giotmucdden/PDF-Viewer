const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const DB_PATH = path.join(__dirname, "..", "data", "band.db");

function getDb() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS songs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT    NOT NULL,
      artist      TEXT    DEFAULT '',
      filename    TEXT    NOT NULL,
      filepath    TEXT    NOT NULL,
      page_count  INTEGER DEFAULT 1,
      created_at  TEXT    DEFAULT (datetime('now')),
      updated_at  TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS setlists (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      date        TEXT    NOT NULL DEFAULT (date('now')),
      created_at  TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS setlist_songs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      setlist_id  INTEGER NOT NULL REFERENCES setlists(id) ON DELETE CASCADE,
      song_id     INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
      position    INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS annotations (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      song_id     INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
      page        INTEGER NOT NULL DEFAULT 1,
      data        TEXT    NOT NULL,
      author      TEXT    DEFAULT '',
      created_at  TEXT    DEFAULT (datetime('now'))
    );
  `);

  // Migration: add date column if missing (existing DBs)
  const cols = db.prepare("PRAGMA table_info(setlists)").all();
  if (!cols.find((c) => c.name === "date")) {
    db.exec("ALTER TABLE setlists ADD COLUMN date TEXT NOT NULL DEFAULT (date('now'))");
  }

  // Recovery: re-import orphaned PDFs in uploads/ that aren't tracked in DB
  const uploadsDir = path.join(__dirname, "..", "uploads");
  if (fs.existsSync(uploadsDir)) {
    const knownFiles = new Set(
      db.prepare("SELECT filepath FROM songs").all().map((r) => r.filepath)
    );
    const pdfFiles = fs
      .readdirSync(uploadsDir)
      .filter((f) => f.toLowerCase().endsWith(".pdf"));

    const insert = db.prepare(
      "INSERT INTO songs (title, artist, filename, filepath, page_count) VALUES (?, '', ?, ?, 1)"
    );
    for (const file of pdfFiles) {
      const rel = `uploads/${file}`;
      if (!knownFiles.has(rel)) {
        const title = file
          .replace(/^\d+-\d+-/, "")
          .replace(/\.pdf$/i, "")
          .replace(/[-_]/g, " ");
        insert.run(title, file, rel);
      }
    }
  }

  return db;
}

module.exports = { getDb };
