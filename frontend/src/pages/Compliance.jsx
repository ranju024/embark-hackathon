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
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isStaff) {
      loadPending();
    }
  }, [isStaff]);

  const handleFileChange = (e) => {
    setPhotoFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!photoFile) {
      setError("Please select a photo.");
      return;
    }
    try {
      await createComplianceCheck(qrCode, photoFile, notes);
      setMessage("Compliance check submitted — pending officer review.");
      setQrCode("");
      setPhotoFile(null);
      setNotes("");
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
    } catch (err) {
      setError("Could not load history.");
    }
  };

  const handleReview = async (id, decision) => {
    try {
      await reviewComplianceCheck(id, decision, "");
      loadPending();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <h2>Compliance Verification</h2>

      <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
        <input value={qrCode} onChange={(e) => setQrCode(e.target.value)} placeholder="Household QR code" />
        <input type="file" accept="image/*" onChange={handleFileChange} />
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" />
        <button type="submit">Submit Check</button>
      </form>

      {message && <p style={{ color: "green" }}>{message}</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {isStaff && (
        <>
          <hr style={{ margin: "24px 0" }} />
          <h3>Pending Review Queue (Staff)</h3>
          {pending.length === 0 && <p>Nothing waiting for review.</p>}
          <ul style={{ listStyle: "none", padding: 0 }}>
            {pending.map((p) => (
              <li key={p.id} style={{ border: "1px solid #ccc", padding: 12, marginBottom: 8 }}>
                <p>{p.household_display} — submitted {new Date(p.checked_at).toLocaleString()}</p>
                {p.notes && <p>Collector notes: {p.notes}</p>}
                <img src={p.photo} alt="Waste photo" width={200} style={{ display: "block", marginBottom: 8 }} />
                <button onClick={() => handleReview(p.id, "compliant")}>Mark Compliant</button>
                <button onClick={() => handleReview(p.id, "non_compliant")} style={{ marginLeft: 8 }}>
                  Mark Non-Compliant
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <hr style={{ margin: "24px 0" }} />
      <h3>View a Household's History</h3>
      <form onSubmit={handleLoadHistory}>
        <input value={historyQr} onChange={(e) => setHistoryQr(e.target.value)} placeholder="Household QR code" />
        <button type="submit">Load History</button>
      </form>
      <ul>
        {history.map((h) => (
          <li key={h.id}>
            {h.status} — {new Date(h.checked_at).toLocaleDateString()} — {h.notes}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Compliance;