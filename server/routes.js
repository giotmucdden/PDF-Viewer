const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { getDb } = require("./db");

const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e4);
    cb(null, unique + "-" + file.originalname);
  },
});
const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype === "application/pdf");
  },
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

// ── Songs ───────────────────────────────────────────────────────────
router.get("/songs", (_req, res) => {
  const db = getDb();
  const songs = db.prepare("SELECT * FROM songs ORDER BY title").all();
  db.close();
  res.json(songs);
});

router.post("/songs", upload.single("pdf"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "PDF file required" });
  const { title, artist } = req.body;
  const db = getDb();
  const info = db
    .prepare(
      "INSERT INTO songs (title, artist, filename, filepath) VALUES (?, ?, ?, ?)"
    )
    .run(
      title || req.file.originalname.replace(".pdf", ""),
      artist || "",
      req.file.filename,
      `/uploads/${req.file.filename}`
    );
  const song = db.prepare("SELECT * FROM songs WHERE id = ?").get(info.lastInsertRowid);
  db.close();
  res.status(201).json(song);
});

router.delete("/songs/:id", (req, res) => {
  const db = getDb();
  const song = db.prepare("SELECT * FROM songs WHERE id = ?").get(req.params.id);
  if (song) {
    const filePath = path.join(UPLOAD_DIR, song.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    db.prepare("DELETE FROM songs WHERE id = ?").run(req.params.id);
  }
  db.close();
  res.json({ ok: true });
});

// ── Setlists ────────────────────────────────────────────────────────
router.get("/setlists", (req, res) => {
  const db = getDb();
  const { month } = req.query; // optional: "2026-02" format
  let setlists;
  if (month) {
    setlists = db
      .prepare("SELECT * FROM setlists WHERE date LIKE ? ORDER BY date, created_at")
      .all(`${month}%`);
  } else {
    setlists = db.prepare("SELECT * FROM setlists ORDER BY date DESC, created_at DESC").all();
  }
  db.close();
  res.json(setlists);
});

router.post("/setlists", (req, res) => {
  const { name, date } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  const db = getDb();
  const info = db
    .prepare("INSERT INTO setlists (name, date) VALUES (?, ?)")
    .run(name, date || new Date().toISOString().slice(0, 10));
  const setlist = db.prepare("SELECT * FROM setlists WHERE id = ?").get(info.lastInsertRowid);
  db.close();
  res.status(201).json(setlist);
});

router.delete("/setlists/:id", (req, res) => {
  const db = getDb();
  db.prepare("DELETE FROM setlists WHERE id = ?").run(req.params.id);
  db.close();
  res.json({ ok: true });
});

router.get("/setlists/:id/songs", (req, res) => {
  const db = getDb();
  const songs = db
    .prepare(
      `SELECT s.*, ss.position, ss.id as setlist_song_id
       FROM setlist_songs ss
       JOIN songs s ON s.id = ss.song_id
       WHERE ss.setlist_id = ?
       ORDER BY ss.position`
    )
    .all(req.params.id);
  db.close();
  res.json(songs);
});

router.post("/setlists/:id/songs", (req, res) => {
  const { song_id, position } = req.body;
  const db = getDb();
  const maxPos = db
    .prepare("SELECT COALESCE(MAX(position),0) as m FROM setlist_songs WHERE setlist_id = ?")
    .get(req.params.id);
  db.prepare(
    "INSERT INTO setlist_songs (setlist_id, song_id, position) VALUES (?, ?, ?)"
  ).run(req.params.id, song_id, position ?? (maxPos.m + 1));
  db.close();
  res.status(201).json({ ok: true });
});

router.delete("/setlists/:setlistId/songs/:songEntryId", (req, res) => {
  const db = getDb();
  db.prepare("DELETE FROM setlist_songs WHERE id = ?").run(req.params.songEntryId);
  db.close();
  res.json({ ok: true });
});

// ── Annotations (persistent) ────────────────────────────────────────
router.get("/songs/:id/annotations", (req, res) => {
  const page = req.query.page || 1;
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM annotations WHERE song_id = ? AND page = ? ORDER BY created_at")
    .all(req.params.id, page);
  db.close();
  res.json(rows);
});

router.post("/songs/:id/annotations", (req, res) => {
  const { page, data, author } = req.body;
  const db = getDb();
  const info = db
    .prepare("INSERT INTO annotations (song_id, page, data, author) VALUES (?, ?, ?, ?)")
    .run(req.params.id, page || 1, JSON.stringify(data), author || "");
  db.close();
  res.status(201).json({ id: info.lastInsertRowid });
});

router.delete("/songs/:id/annotations", (req, res) => {
  const page = req.query.page;
  const db = getDb();
  if (page) {
    db.prepare("DELETE FROM annotations WHERE song_id = ? AND page = ?").run(req.params.id, page);
  } else {
    db.prepare("DELETE FROM annotations WHERE song_id = ?").run(req.params.id);
  }
  db.close();
  res.json({ ok: true });
});

module.exports = router;
