import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { useCamera, useModalBehavior } from "../lib/useCamera";

export default function QrScanner({ onScan, onClose }) {
  const [facing, setFacing] = useState("environment");
  const { videoRef, error, ready } = useCamera({ facing });
  const canvasRef = useRef(null);
  const fileRef = useRef(null);
  const doneRef = useRef(false);
  const onScanRef = useRef(onScan);
  const [imageError, setImageError] = useState("");

  onScanRef.current = onScan;
  useModalBehavior(onClose);

  // Look at the live video about 8 times a second.
  useEffect(() => {
    if (!ready) return undefined;
    let frame;
    let last = 0;

    const tick = (time) => {
      frame = requestAnimationFrame(tick);
      if (doneRef.current || time - last < 120) return;
      last = time;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2 || !video.videoWidth) return;

      const scale = Math.min(1, 640 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const result = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
      if (result?.data) {
        doneRef.current = true;
        onScanRef.current(result.data.trim());
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ready, videoRef]);

  // Laptop path: pick a screenshot or photo of the QR code.
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImageError("");

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
      const canvas = canvasRef.current;
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const result = jsQR(image.data, image.width, image.height);
      URL.revokeObjectURL(url);
      if (result?.data) {
        doneRef.current = true;
        onScanRef.current(result.data.trim());
      } else {
        setImageError("No QR code found in that image. Try a clearer picture.");
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setImageError("Couldn't read that image.");
    };
    img.src = url;
  };

  return (
    <div className="scanner-overlay" role="dialog" aria-modal="true" aria-label="Scan household QR code">
      <div className="scanner-stage">
        {error ? (
          <div className="scanner-error"><p>{error}</p></div>
        ) : (
          <>
            <video ref={videoRef} className="scanner-video" playsInline muted />
            <div className="scanner-frame" />
            <p className="scanner-hint">Point the camera at the household's QR code</p>
          </>
        )}
      </div>

      {imageError && <p className="scanner-error" style={{ margin: 0 }}>{imageError}</p>}
      <canvas ref={canvasRef} hidden />

      <div className="scanner-bar">
        <button type="button" className="btn btn-ghost-light" onClick={() => fileRef.current?.click()}>
          Choose image
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
        {!error && (
          <button
            type="button"
            className="btn btn-ghost-light"
            onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
          >
            Flip camera
          </button>
        )}
        <button type="button" className="btn btn-light" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}