const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const cors = require("cors");
const routes = require("./routes");
const { registerSocketHandlers } = require("./socket");

const PORT = process.env.PORT || 4000;
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
  pingInterval: 10000,
  pingTimeout: 5000,
});

app.use(cors());
app.use(express.json());

// Serve uploaded PDFs
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// API routes
app.use("/api", routes);

// In production serve the built React app
if (process.env.NODE_ENV === "production") {
  const clientDist = path.join(__dirname, "..", "client", "dist");
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

// WebSocket handlers
registerSocketHandlers(io);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🎵 MasterSheet running on http://0.0.0.0:${PORT}`);
});
