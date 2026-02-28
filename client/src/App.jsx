import { useState, useEffect, useCallback } from "react";
import { useSocket } from "./hooks/useSocket";
import { api } from "./api";
import HomePage from "./components/HomePage";
import SingerView from "./components/SingerView";
import BandView from "./components/BandView";
import Sidebar from "./components/Sidebar";
import Viewer from "./components/Viewer";

export default function App() {
  // "home" | "singer" | "band"
  const [view, setView] = useState("home");
  const { socket, connected } = useSocket();
  const [songs, setSongs] = useState([]);
  const [setlists, setSetlists] = useState([]);
  const [activeSong, setActiveSong] = useState(null);
  const [liveState, setLiveState] = useState({});
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const loadSongs = useCallback(async () => {
    const data = await api.getSongs();
    setSongs(data);
  }, []);

  const loadSetlists = useCallback(async () => {
    const data = await api.getSetlists();
    setSetlists(data);
  }, []);

  useEffect(() => {
    if (view === "band") {
      loadSongs();
      loadSetlists();
    }
  }, [view, loadSongs, loadSetlists]);

  // Listen for live state broadcasts
  useEffect(() => {
    const s = socket.current;
    if (!s) return;

    const handleLive = (state) => {
      setLiveState(state);
      if (state.songId) {
        setSongs((prev) => {
          const song = prev.find((x) => x.id === state.songId);
          if (song) setActiveSong(song);
          return prev;
        });
      }
    };

    s.on("live:state", handleLive);
    return () => s.off("live:state", handleLive);
  }, [socket]);

  // ─── Home page ─────────────────────────────────────────────────────
  if (view === "home") {
    return (
      <HomePage
        onLoginBand={() => setView("band")}
        onLoginSinger={() => setView("singer")}
        onLoginBandView={() => setView("bandview")}
      />
    );
  }

  // ─── Singer / Viewer mode ──────────────────────────────────────────
  if (view === "singer") {
    return (
      <SingerView
        socket={socket}
        onLogout={() => setView("home")}
      />
    );
  }

  // ─── Band Viewer mode ───────────────────────────────────────────────
  if (view === "bandview") {
    return (
      <BandView
        socket={socket}
        onLogout={() => setView("home")}
      />
    );
  }

  // ─── Band control mode ─────────────────────────────────────────────
  const handleSelectSong = (song) => {
    setActiveSong(song);
    // On mobile, close sidebar after selecting a song
    if (window.innerWidth <= 768) setSidebarOpen(false);
  };

  return (
    <div className={`app ${sidebarOpen ? "sidebar-open" : "sidebar-collapsed"}`}>
      <button
        className="sidebar-toggle-btn"
        onClick={() => setSidebarOpen((v) => !v)}
        aria-label="Toggle menu"
      >
        {sidebarOpen ? "✕" : "☰"}
      </button>

      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <Sidebar
        songs={songs}
        activeSong={activeSong}
        onSelectSong={handleSelectSong}
        onSongsChange={loadSongs}
        setlists={setlists}
        onSetlistsChange={loadSetlists}
        socket={socket}
        onLogout={() => setView("home")}
      />
      <Viewer
        song={activeSong}
        socket={socket}
        liveState={liveState}
      />
      {!connected && (
        <div
          style={{
            position: "fixed",
            top: 8,
            right: 8,
            background: "#e94560",
            color: "#fff",
            padding: "4px 12px",
            borderRadius: 4,
            fontSize: "0.75rem",
            fontWeight: 600,
          }}
        >
          ⚡ Reconnecting…
        </div>
      )}
    </div>
  );
}
