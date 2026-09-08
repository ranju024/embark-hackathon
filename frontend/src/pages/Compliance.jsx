import { useEffect, useState } from "react";
import {
  createComplianceCheck,
  getComplianceHistory,
  getPendingReviews,
  reviewComplianceCheck,
} from "../api/compliance";

function Compliance({ isStaff }) {
  const [qrCode, setQrCode] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [historyQr, setHistoryQr] = useState("");
  const [history, setHistory] = useState([]);
  const [pending, setPending] = useState([]);

  const loadPending = async () => {
    try {
      const data = await getPendingReviews();
      setPending(data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { if (isStaff) loadPending(); }, [isStaff]);

  const handleFileChange = (e) => setPhotoFile(e.target.files[0]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setMessage("");
    if (!photoFile) { setError("Please select a photo."); return; }
    try {
      await createComplianceCheck(qrCode, photoFile, notes);
      setMessage("Compliance check submitted — pending officer review.");
      setQrCode(""); setPhotoFile(null); setNotes("");
      if (isStaff) loadPending();
    } catch (err) {
      setError(err.response?.data ? JSON.stringify(err.response.data) : "Submission failed.");
    }
  };

  const handleLoadHistory = async (e) => {
    e.preventDefault();
    try {
      const data = await getComplianceHistory(historyQr);
      setHistory(data);
    } catch (err) { setError("Could not load history."); }
  };

  const handleReview = async (id, decision) => {
    try {
      await reviewComplianceCheck(id, decision, "");
      loadPending();
    } catch (err) { console.error(err); }
  };

  // Same status-to-pill mapping idea as Scheduling's result pill and
  // Households' points pills — one more repetition of the pattern.
  const statusPillClass = (status) =>
    status === "compliant" ? "pill pill-success" :
    status === "non_compliant" ? "pill pill-warning" :
    "pill pill-neutral";

  return (
    <div className="page-container">
      <span className="eyebrow">COMPLIANCE VERIFICATION</span>
      <h2>Submit a Waste Check</h2>

      <div className="card" style={{ marginBottom: 20 }}>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input value={qrCode} onChange={(e) => setQrCode(e.target.value)} placeholder="Household QR code" />
          <input type="file" accept="image/*" onChange={handleFileChange} />
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" />
          <button type="submit" className="btn btn-primary">Submit Check</button>
        </form>
        {message && <p style={{ color: "var(--color-primary)" }}>{message}</p>}
        {error && <p style={{ color: "red" }}>{error}</p>}
      </div>

      {isStaff && (
        <div className="card" style={{ marginBottom: 20 }}>
          <span className="eyebrow">PENDING REVIEW QUEUE</span>
          {pending.length === 0 && <p>Nothing waiting for review.</p>}
          {pending.map((p) => (
            <div key={p.id} style={{ display: "flex", gap: 16, padding: "16px 0", borderBottom: "1px solid var(--color-border)", flexWrap: "wrap" }}>
              <img src={p.photo} alt="Waste photo" width={140} style={{ borderRadius: "var(--radius)" }} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <p style={{ margin: 0, fontWeight: 600 }}>{p.household_display}</p>
                <p style={{ margin: "4px 0", color: "var(--color-text-muted)", fontSize: 13 }}>
                  Submitted {new Date(p.checked_at).toLocaleString()}
                </p>
                {p.notes && <p style={{ margin: "4px 0", fontSize: 13 }}>Collector notes: {p.notes}</p>}
                <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                  <button className="btn btn-primary" onClick={() => handleReview(p.id, "compliant")}>Mark Compliant</button>
                  <button className="btn btn-accent" onClick={() => handleReview(p.id, "non_compliant")}>Mark Non-Compliant</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <span className="eyebrow">HOUSEHOLD HISTORY</span>
        <form onSubmit={handleLoadHistory} style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input value={historyQr} onChange={(e) => setHistoryQr(e.target.value)} placeholder="Household QR code" />
          <button type="submit" className="btn btn-outline">Load</button>
        </form>
        {history.map((h) => (
          <div key={h.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--color-border)" }}>
            <span>{new Date(h.checked_at).toLocaleDateString()} — {h.notes}</span>
            <span className={statusPillClass(h.status)}>{h.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Compliance;