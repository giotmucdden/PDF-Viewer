import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { api } from "../api";
import usePdfCanvas from "./PdfCanvas";
import Calendar from "./Calendar";

function ReadOnlyAnnotations({ width, height, strokes }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !width || !height) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const stroke of strokes) {
      if (!stroke.points || stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color || "#e94560";
      ctx.lineWidth = stroke.width || 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }
  }, [width, height, strokes]);

  if (!width || !height) return null;

  return (
    <canvas
      ref={canvasRef}
      className="bandview-annotation-canvas"
      width={width}
      height={height}
    />
  );
}

export default function BandView({ socket, onLogout }) {
  const [setlists, setSetlists] = useState([]);
  const [selectedDate, setSelectedDate] = useState(Calendar.todayStr());
  const [activeSetlist, setActiveSetlist] = useState(null);
  const [setlistSongs, setSetlistSongs] = useState([]);
  const [songIndex, setSongIndex] = useState(-1);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [showUI, setShowUI] = useState(true);
  const [savedStrokes, setSavedStrokes] = useState([]);
  const hideTimer = useRef(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const containerRef = useRef(null);

  const currentSong = songIndex >= 0 ? setlistSongs[songIndex] : null;
  const filePath = currentSong?.filepath || (currentSong?.filename ? `/uploads/${currentSong.filename}` : null);

  const { canvasRef: pdfRef, dims } = usePdfCanvas({
    filePath,
    page,
    onPageCount: setPageCount,
  });

  useEffect(() => {
    api.getSetlists().then(setSetlists).catch(() => {});
  }, []);

  const dateSetlists = useMemo(
    () => setlists.filter((sl) => sl.date === selectedDate),
    [setlists, selectedDate]
  );

  useEffect(() => {
    setActiveSetlist(null);
    setSetlistSongs([]);
    setSongIndex(-1);
    setPage(1);
  }, [selectedDate]);

  // Load annotations when song/page changes
  const loadAnnotations = useCallback(() => {
    if (!currentSong?.id) {
      setSavedStrokes([]);
      return;
    }
    api
      .getAnnotations(currentSong.id, page)
      .then((rows) => {
        const strokes = rows.flatMap((r) => {
          try { return JSON.parse(r.data); } catch { return []; }
        });
        setSavedStrokes(strokes);
      })
      .catch(() => setSavedStrokes([]));
  }, [currentSong?.id, page]);

  useEffect(() => {
    loadAnnotations();
  }, [loadAnnotations]);

  // Listen for live annotation saves to refresh
  useEffect(() => {
    const s = socket?.current;
    if (!s) return;
    const handleSaved = (data) => {
      if (data.songId === currentSong?.id && data.page === page) {
        loadAnnotations();
      }
    };
    s.on("draw:saved", handleSaved);
    return () => s.off("draw:saved", handleSaved);
  }, [socket, currentSong?.id, page, loadAnnotations]);

  // Listen for live state from band leader
  useEffect(() => {
    const s = socket?.current;
    if (!s) return;
    const handleLive = (state) => {
      if (state.page) setPage(state.page);
      if (state.songId && setlistSongs.length > 0) {
        const idx = setlistSongs.findIndex((x) => x.id === state.songId);
        if (idx >= 0) setSongIndex(idx);
      }
    };
    s.on("live:state", handleLive);
    return () => s.off("live:state", handleLive);
  }, [socket, setlistSongs]);

  // Auto-hide UI
  const resetHideTimer = useCallback(() => {
    setShowUI(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (currentSong) {
      hideTimer.current = setTimeout(() => setShowUI(false), 4000);
    }
  }, [currentSong]);

  useEffect(() => {
    resetHideTimer();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [currentSong, page, resetHideTimer]);

  const loadSetlist = async (sl) => {
    setActiveSetlist(sl);
    const songs = await api.getSetlistSongs(sl.id);
    setSetlistSongs(songs);
    setSongIndex(-1);
    setPage(1);
  };

  const openSong = (idx) => {
    setSongIndex(idx);
    setPage(1);
  };

  const changePage = useCallback(
    (delta) => {
      const next = page + delta;
      if (next >= 1 && next <= pageCount) {
        setPage(next);
        return;
      }
      if (delta > 0 && songIndex < setlistSongs.length - 1) {
        setSongIndex(songIndex + 1);
        setPage(1);
      } else if (delta < 0 && songIndex > 0) {
        setSongIndex(songIndex - 1);
        setPage(1);
      }
    },
    [page, pageCount, songIndex, setlistSongs.length]
  );

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (absDx < 50 && absDy < 50) { resetHideTimer(); return; }
    if (absDx > absDy && absDx > 60) {
      if (dx < 0) changePage(1);
      else changePage(-1);
    }
  };

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); changePage(1); }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); changePage(-1); }
      if (e.key === "Escape") {
        if (currentSong) { setSongIndex(-1); setPage(1); }
        else if (activeSetlist) { setActiveSetlist(null); setSetlistSongs([]); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [changePage, currentSong, activeSetlist]);

  const formatDate = (dateStr) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  };

  // ─── Calendar + setlist picker ──────────────────────────────────────
  if (!activeSetlist) {
    return (
      <div className="singer-page" ref={containerRef}>
        <div className="singer-header">
          <button className="singer-back-btn" onClick={onLogout}>← Home</button>
          <h1>🎸 Band Viewer</h1>
        </div>
        <div className="singer-list singer-cal-list">
          <Calendar
            setlists={setlists}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
          <div className="singer-date-label">{formatDate(selectedDate)}</div>
          {dateSetlists.length === 0 && (
            <div className="singer-empty">No setlists on this date</div>
          )}
          {dateSetlists.map((sl) => (
            <button key={sl.id} className="singer-setlist-btn" onClick={() => loadSetlist(sl)}>
              <span className="sl-icon">📋</span>
              <span className="sl-name">{sl.name}</span>
              <span className="sl-arrow">›</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ─── Song picker (within setlist) ──────────────────────────────────
  if (!currentSong) {
    return (
      <div className="singer-page" ref={containerRef}>
        <div className="singer-header">
          <button className="singer-back-btn" onClick={() => { setActiveSetlist(null); setSetlistSongs([]); }}>
            ← Back
          </button>
          <h1>{activeSetlist.name}</h1>
        </div>
        <div className="singer-list">
          {setlistSongs.length === 0 && (
            <div className="singer-empty">No songs in this setlist.</div>
          )}
          {setlistSongs.map((s, i) => (
            <button key={s.setlist_song_id} className="singer-song-btn" onClick={() => openSong(i)}>
              <span className="song-num">{i + 1}</span>
              <div className="song-info">
                <div className="song-name">{s.title}</div>
                {s.artist && <div className="song-artist">{s.artist}</div>}
              </div>
              <span className="sl-arrow">›</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ─── PDF viewer with annotations ─────────────────────────────────
  return (
    <div
      className="singer-viewer"
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={resetHideTimer}
    >
      <div className={`singer-topbar ${showUI ? "visible" : "hidden"}`}>
        <button
          className="singer-topbar-btn"
          onClick={() => { setSongIndex(-1); setPage(1); }}
        >
          ✕
        </button>
        <div className="singer-topbar-title">
          {currentSong.title}
          {currentSong.artist ? ` — ${currentSong.artist}` : ""}
        </div>
        {savedStrokes.length > 0 && (
          <div className="singer-topbar-badge">✏️ Notes</div>
        )}
        <div className="singer-topbar-page">
          {page} / {pageCount}
        </div>
      </div>

      <div className="singer-pdf">
        <div className="bandview-pdf-wrapper">
          <canvas ref={pdfRef} className="singer-canvas" />
          <ReadOnlyAnnotations
            width={dims.width}
            height={dims.height}
            strokes={savedStrokes}
          />
        </div>
      </div>

      <div className={`singer-bottombar ${showUI ? "visible" : "hidden"}`}>
        <button
          className="singer-nav-btn"
          disabled={songIndex <= 0 && page <= 1}
          onClick={() => changePage(-1)}
        >
          ◀ Prev
        </button>
        <div className="singer-song-indicator">
          Song {songIndex + 1}/{setlistSongs.length}
        </div>
        <button
          className="singer-nav-btn"
          disabled={songIndex >= setlistSongs.length - 1 && page >= pageCount}
          onClick={() => changePage(1)}
        >
          Next ▶
        </button>
      </div>

      <div className="singer-tap-left" onClick={() => changePage(-1)} />
      <div className="singer-tap-right" onClick={() => changePage(1)} />
    </div>
  );
}
