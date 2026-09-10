import { useEffect, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";

// A reusable camera-based QR scanner. Renders the browser's camera feed
// into a div, decodes any QR code it sees, and calls onScan with the
// decoded text (your household's qr_code UUID) the moment it succeeds.
function QrScanner({ onScan, onClose }) {
  const scannerRef = useRef(null);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: 250 },
      false
    );
    scannerRef.current = scanner;

    scanner.render(
      (decodedText) => {
        onScan(decodedText);
        scanner.clear().catch(() => {});
      },
      () => {
        // Called on every failed scan attempt (e.g. no QR in frame yet) —
        // intentionally ignored, this fires constantly during normal use.
      }
    );

    return () => {
      scanner.clear().catch(() => {});
    };
  }, []);

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div id="qr-reader" style={{ width: "100%" }}></div>
      <button className="btn btn-outline" onClick={onClose} style={{ marginTop: 8 }}>
        Cancel Scan
      </button>
    </div>
  );
}

export default QrScanner;