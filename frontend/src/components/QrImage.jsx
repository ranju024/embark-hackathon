import { useEffect, useState } from "react";
import { getHouseholdQrBlobUrl } from "../api/households";

// Drop-in replacement for <img> on the QR endpoint.
// Pass the same className you'd give the img (qr-img, qr-small).
function QrImage({ householdId, className, alt = "QR code" }) {
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    setFailed(false);
    getHouseholdQrBlobUrl(householdId)
      .then((url) => { if (!cancelled) setSrc(url); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [householdId]);

  if (src) return <img className={className} src={src} alt={alt} />;

  return (
    <div className={`${className || ""} qr-placeholder`} role={failed ? "img" : "status"} aria-label={failed ? "QR code unavailable" : "Loading QR code"}>
      {failed ? "QR unavailable" : <span className="spinner" aria-hidden="true" />}
    </div>
  );
}

export default QrImage;