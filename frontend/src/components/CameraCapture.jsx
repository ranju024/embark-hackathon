import { useRef, useState } from "react";
import { useCamera, useModalBehavior } from "../lib/useCamera";

// Live camera for taking several photos in a row. Each shot goes to onCapture(file).
export default function CameraCapture({ count, max, onCapture, onClose }) {
  const [facing, setFacing] = useState("environment");
  const { videoRef, error, ready } = useCamera({ facing });
  const canvasRef = useRef(null);
  const [flash, setFlash] = useState(false);

  useModalBehavior(onClose);

  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onCapture(new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" }));
        setFlash(true);
        setTimeout(() => setFlash(false), 120);
      },
      "image/jpeg",
      0.9
    );
  };

  return (
    <div className="scanner-overlay" role="dialog" aria-modal="true" aria-label="Take photos">
      <div className="scanner-stage">
        {error ? (
          <div className="scanner-error"><p>{error}</p></div>
        ) : (
          <video ref={videoRef} className="scanner-video" playsInline muted />
        )}
        {flash && <div className="scanner-flash" />}
        {!error && <p className="scanner-hint">{count} of {max} photos taken</p>}
      </div>

      <canvas ref={canvasRef} hidden />

      <div className="scanner-bar">
        <button type="button" className="btn btn-light" onClick={takePhoto} disabled={!ready || count >= max}>
          {count >= max ? "Photo limit reached" : "Take photo"}
        </button>
        {!error && (
          <button
            type="button"
            className="btn btn-ghost-light"
            onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
          >
            Flip camera
          </button>
        )}
        <button type="button" className="btn btn-ghost-light" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}