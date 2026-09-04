import { useState } from "react";
import { createComplianceCheck, getComplianceHistory } from "../api/compliance";

function Compliance() {
  const [qrCode, setQrCode] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [status, setStatus] = useState("compliant");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [historyQr, setHistoryQr] = useState("");
  const [history, setHistory] = useState([]);

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
      await createComplianceCheck(qrCode, photoFile, status, notes);
      setMessage("Compliance check submitted.");
      setQrCode("");
      setPhotoFile(null);
      setNotes("");
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

  return (
    <div>
      <h2>Compliance Verification</h2>

      <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
        <input
          value={qrCode}
          onChange={(e) => setQrCode(e.target.value)}
          placeholder="Household QR code"
        />
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="compliant">Compliant</option>
          <option value="non_compliant">Non-Compliant</option>
        </select>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
        />
        <button type="submit">Submit Check</button>
      </form>

      {message && <p style={{ color: "green" }}>{message}</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      <h3>View a Household's History</h3>
      <form onSubmit={handleLoadHistory}>
        <input
          value={historyQr}
          onChange={(e) => setHistoryQr(e.target.value)}
          placeholder="Household QR code"
        />
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