import { useState, useRef, useEffect, useMemo } from "react";
import { api } from "../api";
import Calendar from "./Calendar";

export default function Sidebar({
  songs,
  activeSong,
  onSelectSong,
  onSongsChange,
  setlists,
  onSetlistsChange,
  socket,
  onLogout,
}) {
  const [tab, setTab] = useState("songs");
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);

  // Search
  const [searchSongs, setSearchSongs] = useState("");
  const [addSongSearch, setAddSongSearch] = useState("");

  // Calendar + setlist state
  const [selectedDate, setSelectedDate] = useState(Calendar.todayStr());
  const [activeSetlistId, setActiveSetlistId] = useState(null);
  const [setlistSongs, setSetlistSongs] = useState([]);
  const [newSetlistName, setNewSetlistName] = useState("");

  // Setlists for the selected date
  const dateSetlists = useMemo(
    () => setlists.filter((sl) => sl.date === selectedDate),
    [setlists, selectedDate]
  );

  // Reset active setlist when date changes
  useEffect(() => {
    setActiveSetlistId(null);
    setSetlistSongs([]);
  }, [selectedDate]);

  const matchesSearch = (song, query) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      song.title?.toLowerCase().includes(q) ||
      song.artist?.toLowerCase().includes(q)
    );
  };

  const filteredSongs = songs.filter((s) => matchesSearch(s, searchSongs));

  const setlistSongIds = new Set(setlistSongs.map((s) => s.id));
  const addSongResults = songs.filter(
    (s) =>
      (!addSongSearch.trim() || matchesSearch(s, addSongSearch)) &&
      !setlistSongIds.has(s.id)
  );

  const handleFileSelect = (file) => {
    if (!file || file.type !== "application/pdf") return;
    setPendingFile(file);
    setTitle(file.name.replace(/\.pdf$/i, ""));
  };

  const handleUpload = async () => {
    if (!pendingFile) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("pdf", pendingFile);
    fd.append("title", title);
    fd.append("artist", artist);
    try {
      await api.uploadSong(fd);
      onSongsChange();
      setPendingFile(null);
      setTitle("");
      setArtist("");
    } catch (e) {
      console.error("Upload failed:", e);
    }
    setUploading(false);
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    await api.deleteSong(id);
    onSongsChange();
  };

  const handleSelectSong = (song) => {
    onSelectSong(song);
    socket?.current?.emit("live:setSong", { songId: song.id, page: 1 });
  };

  // Setlist functions
  const loadSetlistSongs = async (id) => {
    setActiveSetlistId(id);
    const songs = await api.getSetlistSongs(id);
    setSetlistSongs(songs);
    socket?.current?.emit("live:setSetlist", { setlistId: id });
  };

  const createSetlist = async () => {
    if (!newSetlistName.trim()) return;
    await api.createSetlist(newSetlistName, selectedDate);
    setNewSetlistName("");
    onSetlistsChange();
  };

  const deleteSetlist = async (id, e) => {
    e.stopPropagation();
    await api.deleteSetlist(id);
    if (activeSetlistId === id) {
      setActiveSetlistId(null);
      setSetlistSongs([]);
    }
    onSetlistsChange();
  };

  const addToSetlist = async (songId) => {
    if (!activeSetlistId || !songId) return;
    await api.addSongToSetlist(activeSetlistId, songId);
    setAddSongSearch("");
    loadSetlistSongs(activeSetlistId);
  };

  const removeFromSetlist = async (entryId) => {
    if (!activeSetlistId) return;
    await api.removeSongFromSetlist(activeSetlistId, entryId);
    loadSetlistSongs(activeSetlistId);
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h1>🎵 MasterSheet</h1>
        <small>Live Music Sheet Viewer</small>
        {onLogout && (
          <button className="sidebar-logout" onClick={onLogout}>← Home</button>
        )}
      </div>

      <div className="sidebar-tabs">
        <button
          className={tab === "songs" ? "active" : ""}
          onClick={() => setTab("songs")}
        >
          Songs
        </button>
        <button
          className={tab === "setlists" ? "active" : ""}
          onClick={() => setTab("setlists")}
        >
          Setlists
        </button>
      </div>

      <div className="sidebar-content">
        {/* ── Songs tab ───────────────────────────────────────────── */}
        {tab === "songs" && (
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search songs…"
              value={searchSongs}
              onChange={(e) => setSearchSongs(e.target.value)}
            />
            {searchSongs && (
              <button className="search-clear" onClick={() => setSearchSongs("")}>
                ×
              </button>
            )}
          </div>
        )}

        {tab === "songs" &&
          filteredSongs.map((song) => (
            <div
              key={song.id}
              className={`song-item ${activeSong?.id === song.id ? "active" : ""}`}
              onClick={() => handleSelectSong(song)}
            >
              <div>
                <div className="title">{song.title}</div>
                {song.artist && <div className="artist">{song.artist}</div>}
              </div>
              <button
                className="delete-btn"
                onClick={(e) => handleDelete(song.id, e)}
              >
                ×
              </button>
            </div>
          ))}

        {/* ── Setlists tab (calendar) ─────────────────────────────── */}
        {tab === "setlists" && (
          <>
            <Calendar
              compact
              setlists={setlists}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />

            <div className="cal-date-label">
              📅 {formatDate(selectedDate)}
              {dateSetlists.length > 0 && (
                <span className="cal-date-count">{dateSetlists.length} setlist{dateSetlists.length > 1 ? "s" : ""}</span>
              )}
            </div>

            {/* Create new setlist for selected date */}
            <div className="setlist-header">
              <input
                placeholder={`New setlist for ${selectedDate}…`}
                value={newSetlistName}
                onChange={(e) => setNewSetlistName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createSetlist()}
              />
              <button onClick={createSetlist}>+ New</button>
            </div>

            {/* Setlists on this date */}
            {dateSetlists.length === 0 && (
              <div className="no-results" style={{ padding: "16px 0" }}>
                No setlists on this date
              </div>
            )}

            {dateSetlists.map((sl) => (
              <div
                key={sl.id}
                className={`song-item ${activeSetlistId === sl.id ? "active" : ""}`}
                onClick={() => loadSetlistSongs(sl.id)}
              >
                <div className="title">📋 {sl.name}</div>
                <button
                  className="delete-btn"
                  onClick={(e) => deleteSetlist(sl.id, e)}
                >
                  ×
                </button>
              </div>
            ))}

            {/* Active setlist songs */}
            {activeSetlistId && (
              <>
                <hr style={{ borderColor: "var(--border)", margin: "12px 0" }} />
                <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: 8 }}>
                  Songs in setlist ({setlistSongs.length}):
                </div>

                {setlistSongs.map((s, i) => (
                  <div
                    key={s.setlist_song_id}
                    className={`song-item ${activeSong?.id === s.id ? "active" : ""}`}
                    onClick={() => handleSelectSong(s)}
                  >
                    <div>
                      <div className="title">
                        {i + 1}. {s.title}
                      </div>
                      {s.artist && <div className="artist">{s.artist}</div>}
                    </div>
                    <button
                      className="delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromSetlist(s.setlist_song_id);
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}

                <div className="add-song-section">
                  <div className="search-bar">
                    <span className="search-icon">➕</span>
                    <input
                      type="text"
                      placeholder="Search to add song…"
                      value={addSongSearch}
                      onChange={(e) => setAddSongSearch(e.target.value)}
                    />
                    {addSongSearch && (
                      <button className="search-clear" onClick={() => setAddSongSearch("")}>
                        ×
                      </button>
                    )}
                  </div>
                  {addSongResults.length > 0 && (
                    <div className="add-song-results">
                      {addSongResults.map((s) => (
                        <div
                          key={s.id}
                          className="add-song-item"
                          onClick={() => addToSetlist(s.id)}
                        >
                          <div>
                            <div className="title">{s.title}</div>
                            {s.artist && <div className="artist">{s.artist}</div>}
                          </div>
                          <span className="add-btn">+</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {addSongSearch.trim() && addSongResults.length === 0 && (
                    <div className="no-results">No matching songs found</div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <div className="upload-area">
        <div
          className={`upload-zone ${dragging ? "dragging" : ""}`}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFileSelect(e.dataTransfer.files[0]);
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            onChange={(e) => handleFileSelect(e.target.files[0])}
          />
          <p>
            {pendingFile
              ? `📄 ${pendingFile.name}`
              : "Drop PDF here or click to browse"}
          </p>
        </div>
        {pendingFile && (
          <div className="upload-fields">
            <input
              placeholder="Song title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <input
              placeholder="Artist (optional)"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
            />
            <button onClick={handleUpload} disabled={uploading}>
              {uploading ? "Uploading…" : "Upload"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
