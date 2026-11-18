import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import { useModalBehavior } from "../lib/useCamera";

export function ImageViewer({ urls, startIndex = 0, onClose }) {
  const [index, setIndex] = useState(startIndex);
  const closeRef = useRef(null);
  const count = urls.length;

  const prev = useCallback(() => setIndex((i) => (i - 1 + count) % count), [count]);
  const next = useCallback(() => setIndex((i) => (i + 1) % count), [count]);

  useModalBehavior(onClose); // Esc closes, and the page behind stops scrolling

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => {
      if (count < 2) return;
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [count, prev, next]);

  const stop = (handler) => (e) => {
    e.stopPropagation(); // clicks on the controls shouldn't close the viewer
    handler?.();
  };

  return (
    <div className="viewer-overlay" role="dialog" aria-modal="true" aria-label="Photo viewer" onClick={onClose}>
      <button ref={closeRef} type="button" className="viewer-close" aria-label="Close photo" onClick={onClose}>
        <Icon name="x" size={24} />
      </button>

      {count > 1 && <p className="viewer-count">{index + 1} / {count}</p>}

      {count > 1 && (
        <button type="button" className="viewer-nav viewer-prev" aria-label="Previous photo" onClick={stop(prev)}>
          ‹
        </button>
      )}

      <img
        className="viewer-img"
        src={urls[index]}
        alt={`Photo ${index + 1} of ${count}`}
        onClick={stop()}
      />

      {count > 1 && (
        <button type="button" className="viewer-nav viewer-next" aria-label="Next photo" onClick={stop(next)}>
          ›
        </button>
      )}

      <a className="viewer-open" href={urls[index]} target="_blank" rel="noreferrer" onClick={stop()}>
        Open original
      </a>
    </div>
  );
}

// A row of thumbnails. Clicking one opens the viewer on that photo.
export default function PhotoGallery({ urls, size = 84, alt = "Photo" }) {
  const [openIndex, setOpenIndex] = useState(null);
  if (!urls || urls.length === 0) return null;

  return (
    <>
      <div className="photo-strip">
        {urls.map((url, i) => (
          <button
            key={url}
            type="button"
            className="photo-thumb"
            aria-label={`Open photo ${i + 1} of ${urls.length}`}
            onClick={() => setOpenIndex(i)}
          >
            <img src={url} alt={`${alt} ${i + 1}`} style={{ width: size, height: size }} />
          </button>
        ))}
      </div>
      {openIndex !== null && (
        <ImageViewer urls={urls} startIndex={openIndex} onClose={() => setOpenIndex(null)} />
      )}
    </>
  );
}