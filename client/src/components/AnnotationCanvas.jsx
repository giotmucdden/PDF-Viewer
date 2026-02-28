import { useEffect, useRef, useCallback } from "react";

// Point-to-segment distance for hit testing
function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  const ex = px - projX;
  const ey = py - projY;
  return Math.sqrt(ex * ex + ey * ey);
}

function strokeHitTest(stroke, px, py, radius) {
  const pts = stroke.points;
  for (let i = 0; i < pts.length - 1; i++) {
    if (distToSegment(px, py, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y) < radius + stroke.width / 2) {
      return true;
    }
  }
  return false;
}

export default function AnnotationCanvas({
  width,
  height,
  socket,
  songId,
  page,
  drawEnabled,
  eraseMode,
  color,
  strokeWidth,
  eraserWidth,
  savedStrokes,
}) {
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const currentStroke = useRef(null);
  const allStrokes = useRef([]);

  const redrawAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const stroke of allStrokes.current) {
      if (stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }
  }, []);

  // Load saved strokes into the ref when savedStrokes state changes
  useEffect(() => {
    allStrokes.current = savedStrokes ? [...savedStrokes] : [];
    redrawAll();
  }, [savedStrokes, songId, page, redrawAll]);

  // Redraw when canvas dimensions change (PDF finished rendering / resize)
  useEffect(() => {
    redrawAll();
  }, [width, height, redrawAll]);

  useEffect(() => {
    const s = socket?.current;
    if (!s) return;

    const handleStroke = (stroke) => {
      if (stroke.songId !== songId || stroke.page !== page) return;
      allStrokes.current.push(stroke);
      redrawAll();
    };

    const handleClear = (data) => {
      if (data.songId !== songId || data.page !== page) return;
      allStrokes.current = [];
      redrawAll();
    };

    const handleErase = (data) => {
      if (data.songId !== songId || data.page !== page) return;
      const removed = new Set(data.indices);
      allStrokes.current = allStrokes.current.filter((_, i) => !removed.has(i));
      redrawAll();
    };

    s.on("draw:stroke", handleStroke);
    s.on("draw:clear", handleClear);
    s.on("draw:erase", handleErase);

    return () => {
      s.off("draw:stroke", handleStroke);
      s.off("draw:clear", handleClear);
      s.off("draw:erase", handleErase);
    };
  }, [socket, songId, page, redrawAll]);

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const eraseAt = (pos) => {
    const radius = eraserWidth / 2;
    const indicesToRemove = [];
    allStrokes.current.forEach((stroke, i) => {
      if (strokeHitTest(stroke, pos.x, pos.y, radius)) {
        indicesToRemove.push(i);
      }
    });
    if (indicesToRemove.length > 0) {
      socket?.current?.emit("draw:erase", { songId, page, indices: indicesToRemove });
      const removed = new Set(indicesToRemove);
      allStrokes.current = allStrokes.current.filter((_, i) => !removed.has(i));
      redrawAll();
    }
  };

  const startDraw = (e) => {
    if (!drawEnabled) return;
    e.preventDefault();
    isDrawing.current = true;

    if (eraseMode) {
      eraseAt(getPos(e));
      return;
    }

    const pos = getPos(e);
    currentStroke.current = {
      songId,
      page,
      color,
      width: strokeWidth,
      points: [pos],
    };
  };

  const moveDraw = (e) => {
    if (!isDrawing.current) return;
    e.preventDefault();

    if (eraseMode) {
      eraseAt(getPos(e));
      return;
    }

    if (!currentStroke.current) return;
    const pos = getPos(e);
    currentStroke.current.points.push(pos);

    const ctx = canvasRef.current.getContext("2d");
    const pts = currentStroke.current.points;
    if (pts.length >= 2) {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      ctx.stroke();
    }
  };

  const endDraw = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    if (eraseMode) return;

    const stroke = currentStroke.current;
    if (stroke && stroke.points.length >= 2) {
      allStrokes.current.push(stroke);
      socket?.current?.emit("draw:stroke", stroke);
    }
    currentStroke.current = null;
  };

  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.__getStrokes = () => allStrokes.current;
    }
  });

  // Lock body scroll when drawing is enabled to prevent page drag on touch
  useEffect(() => {
    if (!drawEnabled) return;
    const prevent = (e) => e.preventDefault();
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
    document.body.style.touchAction = "none";
    document.addEventListener("touchmove", prevent, { passive: false });
    return () => {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.touchAction = "";
      document.removeEventListener("touchmove", prevent);
    };
  }, [drawEnabled]);

  // Attach non-passive touch listeners directly so preventDefault works
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !drawEnabled) return;

    const onTouchStart = (e) => { e.preventDefault(); startDraw(e); };
    const onTouchMove = (e) => { e.preventDefault(); moveDraw(e); };
    const onTouchEnd = (e) => { endDraw(e); };

    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);

    return () => {
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  });

  const cursorClass = eraseMode ? "eraser-cursor" : "";

  return (
    <canvas
      ref={canvasRef}
      className={`annotation-canvas ${cursorClass}`}
      width={width}
      height={height}
      style={{ pointerEvents: drawEnabled ? "auto" : "none", touchAction: drawEnabled ? "none" : "auto" }}
      onMouseDown={startDraw}
      onMouseMove={moveDraw}
      onMouseUp={endDraw}
      onMouseLeave={endDraw}
    />
  );
}
