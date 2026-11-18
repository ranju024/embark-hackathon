import { useEffect, useRef, useState } from "react";

function describeCameraError(err) {
  switch (err?.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Camera access was blocked. Allow the camera for this site in your browser settings, or choose a file instead.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No camera was found on this device. Choose a file instead.";
    case "NotReadableError":
      return "The camera is being used by another app. Close it and try again.";
    default:
      return "Couldn't start the camera. You can choose a file instead.";
  }
}

// Starts the camera, attaches it to videoRef and stops it again on unmount or when `facing` changes.
export function useCamera({ facing = "environment" } = {}) {
  const videoRef = useRef(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let stream = null;
    setError("");
    setReady(false);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("The camera needs a secure connection (HTTPS) or localhost. Choose a file instead.");
      return undefined;
    }

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      .then((mediaStream) => {
        if (cancelled) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = mediaStream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.play().catch(() => {}).finally(() => !cancelled && setReady(true));
      })
      .catch((err) => {
        if (!cancelled) setError(describeCameraError(err));
      });

    return () => {
      cancelled = true;
      if (stream) stream.getTracks().forEach((track) => track.stop());
    };
  }, [facing]);

  return { videoRef, error, ready };
}

// Escape closes the modal, and the page behind it doesn't scroll.
export function useModalBehavior(onClose) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);
}