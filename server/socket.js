const { getDb } = require("./db");

function registerSocketHandlers(io) {
  // Shared live state
  let liveState = {
    songId: null,
    page: 1,
    setlistId: null,
  };

  io.on("connection", (socket) => {
    console.log(`[ws] connected: ${socket.id}`);

    // Send current live state to new joiners
    socket.emit("live:state", liveState);

    // ── Band leader changes the active song ─────────────────────────
    socket.on("live:setSong", ({ songId, page }) => {
      liveState.songId = songId;
      liveState.page = page || 1;
      io.emit("live:state", liveState);
    });

    // ── Page navigation (next / prev) ───────────────────────────────
    socket.on("live:setPage", ({ page }) => {
      liveState.page = page;
      io.emit("live:state", liveState);
    });

    // ── Setlist selection ───────────────────────────────────────────
    socket.on("live:setSetlist", ({ setlistId }) => {
      liveState.setlistId = setlistId;
      io.emit("live:state", liveState);
    });

    // ── Real-time drawing strokes ───────────────────────────────────
    socket.on("draw:stroke", (stroke) => {
      // Broadcast to everyone except sender
      socket.broadcast.emit("draw:stroke", stroke);
    });

    socket.on("draw:clear", ({ songId, page }) => {
      // Clear persisted annotations
      const db = getDb();
      db.prepare("DELETE FROM annotations WHERE song_id = ? AND page = ?").run(songId, page);
      db.close();
      io.emit("draw:clear", { songId, page });
    });

    // Erase specific strokes — broadcast indices to remove
    socket.on("draw:erase", ({ songId, page, indices }) => {
      socket.broadcast.emit("draw:erase", { songId, page, indices });
    });

    // ── Save annotation snapshot (persist) ──────────────────────────
    socket.on("draw:save", ({ songId, page, data, author }) => {
      const db = getDb();
      // Replace existing annotations for this song+page
      db.prepare("DELETE FROM annotations WHERE song_id = ? AND page = ?").run(songId, page);
      db.prepare(
        "INSERT INTO annotations (song_id, page, data, author) VALUES (?, ?, ?, ?)"
      ).run(songId, page, JSON.stringify(data), author || "");
      db.close();
      io.emit("draw:saved", { songId, page });
    });

    socket.on("disconnect", () => {
      console.log(`[ws] disconnected: ${socket.id}`);
    });
  });
}

module.exports = { registerSocketHandlers };
