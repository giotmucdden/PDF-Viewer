import { useState, useRef, useEffect, useCallback } from "react";
import usePdfCanvas from "./PdfCanvas";
import AnnotationCanvas from "./AnnotationCanvas";
import { api } from "../api";

const COLORS = ["#e94560", "#4ade80", "#38bdf8", "#fbbf24", "#ffffff"];

export default function Viewer({ song, socket, liveState }) {
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [drawEnabled, setDrawEnabled] = useState(false);
  const [eraseMode, setEraseMode] = useState(false);
  const [color, setColor] = useState(COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [eraserWidth, setEraserWidth] = useState(20);
  const [savedStrokes, setSavedStrokes] = useState([]);
  const [toast, setToast] = useState(null);
  const annotRef = useRef(null);

  const filePath =
    song?.filepath ||
    (song?.filename ? `/uploads/${song.filename}` : null);

  const { canvasRef: pdfRef, dims } = usePdfCanvas({
    filePath,
    page,
    onPageCount: setPageCount,
  });

  // Sync page from live state
  useEffect(() => {
    if (liveState?.songId === song?.id && liveState?.page) {
      setPage(liveState.page);
    }
  }, [liveState, song]);

  // Load saved annotations when song/page changes
  const loadAnnotations = useCallback(() => {
    if (!song?.id) return;
    api
      .getAnnotations(song.id, page)
      .then((rows) => {
        const strokes = rows.flatMap((r) => {
          try {
            return JSON.parse(r.data);
          } catch {
            return [];
          }
        });
        setSavedStrokes(strokes);
      })
      .catch(() => setSavedStrokes([]));
  }, [song?.id, page]);

  useEffect(() => {
    loadAnnotations();
  }, [loadAnnotations]);

  // Listen for save confirmations to refresh local state
  useEffect(() => {
    const s = socket?.current;
    if (!s) return;
    const handleSaved = (data) => {
      if (data.songId === song?.id && data.page === page) {
        loadAnnotations();
      }
    };
    s.on("draw:saved", handleSaved);
    return () => s.off("draw:saved", handleSaved);
  }, [socket, song?.id, page, loadAnnotations]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const changePage = useCallback(
    (delta) => {
      const next = Math.max(1, Math.min(pageCount, page + delta));
      setPage(next);
      socket?.current?.emit("live:setPage", { page: next });
    },
    [page, pageCount, socket]
  );

  const saveAnnotations = () => {
    const canvas = document.querySelector(".annotation-canvas");
    const strokes = canvas?.__getStrokes?.() || [];
    if (!song?.id) return;
    socket?.current?.emit("draw:save", {
      songId: song.id,
      page,
      data: strokes,
      author: "",
    });
    showToast(strokes.length > 0 ? "Annotations saved!" : "Annotations cleared!");
  };

  const clearAnnotations = () => {
    if (!song?.id) return;
    socket?.current?.emit("draw:clear", { songId: song.id, page });
  };

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        changePage(1);
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        changePage(-1);
      }
      if (e.key === "d" || e.key === "D") {
        setDrawEnabled((v) => !v);
        setEraseMode(false);
      }
      if (e.key === "e" || e.key === "E") {
        setDrawEnabled(true);
        setEraseMode((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [changePage]);

  if (!song) {
    return (
      <div className="viewer">
        <div className="empty-state">
          <div className="icon">🎵</div>
          <p>Select a song or upload a PDF to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="viewer">
      <div className="viewer-toolbar">
        <span className="song-title">
          {song.title}
          {song.artist ? ` — ${song.artist}` : ""}
        </span>

        <button onClick={() => changePage(-1)} disabled={page <= 1}>
          ◀ Prev
        </button>
        <span className="page-info">
          {page} / {pageCount}
        </span>
        <button onClick={() => changePage(1)} disabled={page >= pageCount}>
          Next ▶
        </button>

        <button
          className={drawEnabled && !eraseMode ? "active" : ""}
          onClick={() => {
            setDrawEnabled(true);
            setEraseMode(false);
          }}
        >
          ✏️ Draw
        </button>

        <button
          className={drawEnabled && eraseMode ? "active eraser-active" : ""}
          onClick={() => {
            setDrawEnabled(true);
            setEraseMode(true);
          }}
        >
          🧹 Eraser
        </button>

        {drawEnabled && !eraseMode && (
          <>
            <div className="color-picker">
              {COLORS.map((c) => (
                <div
                  key={c}
                  className={`color-dot ${color === c ? "active" : ""}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
            <input
              type="range"
              className="stroke-width"
              min="1"
              max="12"
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(Number(e.target.value))}
              title="Stroke width"
            />
          </>
        )}

        {drawEnabled && eraseMode && (
          <label className="eraser-size-label">
            Size
            <input
              type="range"
              className="stroke-width"
              min="8"
              max="60"
              value={eraserWidth}
              onChange={(e) => setEraserWidth(Number(e.target.value))}
              title="Eraser size"
            />
          </label>
        )}

        {drawEnabled && (
          <button
            onClick={() => {
              setDrawEnabled(false);
              setEraseMode(false);
            }}
          >
            ✖ Off
          </button>
        )}

        <button onClick={saveAnnotations}>💾 Save</button>
        <button onClick={clearAnnotations}>🗑 Clear</button>
      </div>

      <div className={`pdf-container ${drawEnabled ? "drawing-active" : ""}`}>
        <div className="canvas-wrapper">
          <canvas ref={pdfRef} style={{ width: "100%", height: "auto" }} />
          {dims.width > 0 && (
            <AnnotationCanvas
              ref={annotRef}
              width={dims.width}
              height={dims.height}
              socket={socket}
              songId={song.id}
              page={page}
              drawEnabled={drawEnabled}
              eraseMode={eraseMode}
              color={color}
              strokeWidth={strokeWidth}
              eraserWidth={eraserWidth}
              savedStrokes={savedStrokes}
            />
          )}
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
