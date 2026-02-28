import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const SCALE = 1.5;

export default function PdfCanvas({ filePath, page, onPageCount }) {
  const canvasRef = useRef(null);
  const [dims, setDims] = useState({ width: 0, height: 0 });
  const pdfDocRef = useRef(null);
  const renderTaskRef = useRef(null);

  useEffect(() => {
    if (!filePath) return;

    let cancelled = false;
    const loadPdf = async () => {
      try {
        const doc = await pdfjsLib.getDocument(filePath).promise;
        if (cancelled) return;
        pdfDocRef.current = doc;
        onPageCount?.(doc.numPages);
        renderPage(doc, page);
      } catch (err) {
        console.error("PDF load error:", err);
      }
    };

    loadPdf();
    return () => { cancelled = true; };
  }, [filePath]);

  useEffect(() => {
    if (pdfDocRef.current) {
      renderPage(pdfDocRef.current, page);
    }
  }, [page]);

  const renderPage = async (doc, pageNum) => {
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
    }
    try {
      const p = await doc.getPage(Math.min(pageNum, doc.numPages));
      const viewport = p.getViewport({ scale: SCALE });
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      setDims({ width: viewport.width, height: viewport.height });

      const ctx = canvas.getContext("2d");
      const task = p.render({ canvasContext: ctx, viewport });
      renderTaskRef.current = task;
      await task.promise;
    } catch (err) {
      if (err?.name !== "RenderingCancelledException") {
        console.error("Render error:", err);
      }
    }
  };

  return { canvasRef, dims };
}
