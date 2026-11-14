import { useEffect, useState } from "react";
import {
  getComplaints, getAppealableChecks, fileComplaint,
  startComplaintReview, resolveComplaint,
} from "../api/complaints";

const CATEGORY_OPTIONS = [
  ["missed_pickup", "Missed pickup"],
  ["bin_or_bag_issue", "Bin or bag issue"],
  ["collector_conduct", "Collector conduct"],
  ["illegal_dumping", "Illegal dumping"],
  ["appeal", "Appeal a compliance result"],
  ["other", "Other"],
];

const STATUS_TABS = [
  ["active", "Active"],
  ["open", "Open"],
  ["under_review", "Under review"],
  ["resolved", "Resolved"],
  ["rejected", "Rejected"],
];

function statusPillClass(status) {
  if (status === "resolved") return "pill pill-success";
  if (status === "open") return "pill pill-warning";
  return "pill pill-neutral";
}

// DRF returns errors as {detail}, {field: [msgs]} or {non_field_errors: [msgs]}.
function formatApiError(err, fallback) {
  const data = err.response?.data;
  if (!data || typeof data === "string") return fallback;
  if (data.detail) return data.detail;
  const parts = Object.values(data).flat().filter((v) => typeof v === "string");
  return parts.length ? parts.join(" ") : fallback;
}

function ComplaintDetails({ complaint, showHousehold }) {
  return (
    <>
      {showHousehold && (
        <p style={{ margin: "0 0 4px", fontWeight: 600 }}>
          Ward {complaint.ward_number} — House {complaint.house_number} · {complaint.owner_name}
        </p>
      )}
      <p style={{ margin: "0 0 4px", fontSize: 13, color: "var(--color-text-muted)" }}>
        {complaint.category_display} · filed {new Date(complaint.created_at).toLocaleDateString()}
      </p>
      <p style={{ margin: "4px 0" }}>{complaint.description}</p>
      {complaint.check_summary && (
        <p style={{ margin: "4px 0", fontSize: 13 }}>
          Appeal against the {new Date(complaint.check_summary.date).toLocaleDateString()} check:{" "}
          {complaint.check_summary.waste_type}, {complaint.check_summary.weight_kg.toFixed(2)} kg,
          marked {complaint.check_summary.status.replace("_", " ")}
        </p>
      )}
      {complaint.photo && (
        <a href={complaint.photo} target="_blank" rel="noreferrer">
          <img src={complaint.photo} alt="Complaint evidence" width={140} style={{ borderRadius: "var(--radius)", marginTop: 4 }} />
        </a>
      )}
      {complaint.resolution_notes && (
        <p style={{ margin: "8px 0 0", padding: 8, background: "var(--color-surface, #f4f6f4)", borderRadius: "var(--radius)" }}>
          <strong>Officer's response{complaint.handled_by_username ? ` (${complaint.handled_by_username})` : ""}:</strong>{" "}
          {complaint.resolution_notes}
        </p>
      )}
    </>
  );
}

/* ------------------------------------------------------------- resident */

function ResidentComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [appealable, setAppealable] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [category, setCategory] = useState("missed_pickup");
  const [checkId, setCheckId] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState(null);
  const [fileKey, setFileKey] = useState(0); // changing the key clears the file input
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const [complaintData, appealableData] = await Promise.all([getComplaints(), getAppealableChecks()]);
      setComplaints(complaintData);
      setAppealable(appealableData);
    } catch (err) {
      setLoadError("Couldn't load your complaints. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");
    setSubmitting(true);
    try {
      await fileComplaint({
        category,
        description,
        complianceCheckId: category === "appeal" ? checkId : null,
        photo,
      });
      setMessage(category === "appeal" ? "Appeal submitted. An officer will review it." : "Complaint submitted. An officer will review it.");
      setDescription("");
      setCheckId("");
      setPhoto(null);
      setFileKey((k) => k + 1);
      load();
    } catch (err) {
      setError(formatApiError(err, "Could not submit. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p>Loading...</p>;
  if (loadError) return <p style={{ color: "red" }}>{loadError}</p>;

  return (
    <>
      <div className="card" style={{ marginBottom: 20 }}>
        <span className="eyebrow">FILE A COMPLAINT OR APPEAL</span>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORY_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          {category === "appeal" && (
            appealable.length > 0 ? (
              <select value={checkId} onChange={(e) => setCheckId(e.target.value)} required>
                <option value="">Select the result to appeal</option>
                {appealable.map((c) => (
                  <option key={c.id} value={c.id}>
                    {new Date(c.checked_on).toLocaleDateString()} — {c.waste_type}, {c.weight_kg.toFixed(2)} kg
                    (appeal by {new Date(c.appeal_deadline).toLocaleDateString()})
                  </option>
                ))}
              </select>
            ) : (
              <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
                No results can be appealed right now. You can appeal a non-compliant result within 7 days of it being reviewed.
              </p>
            )
          )}

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={category === "appeal" ? "Explain why this result should be changed (at least 10 characters)" : "Describe the problem (at least 10 characters)"}
            rows={4}
            maxLength={1000}
            required
          />
          <input key={fileKey} type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files[0] || null)} />
          <small style={{ color: "var(--color-text-muted)" }}>Optional photo, up to 5 MB.</small>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || (category === "appeal" && appealable.length === 0)}
          >
            {submitting ? "Submitting..." : "Submit"}
          </button>
        </form>
        {message && <p style={{ color: "var(--color-primary)" }}>{message}</p>}
        {error && <p style={{ color: "red" }}>{error}</p>}
      </div>

      <div className="card">
        <span className="eyebrow">YOUR COMPLAINTS</span>
        {complaints.length === 0 && <p>You haven't filed any complaints.</p>}
        {complaints.map((c) => (
          <div key={c.id} style={{ padding: "14px 0", borderBottom: "1px solid var(--color-border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
              <span />
              <span className={statusPillClass(c.status)}>{c.status_display}</span>
            </div>
            <ComplaintDetails complaint={c} />
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- staff */

function StaffComplaintCard({ complaint, onChanged }) {
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isAppeal = !!complaint.compliance_check;
  const isClosed = complaint.status === "resolved" || complaint.status === "rejected";

  const run = async (action) => {
    setBusy(true);
    setError("");
    try {
      await action();
      setNotes("");
      onChanged();
    } catch (err) {
      setError(formatApiError(err, "Action failed. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: "16px 0", borderBottom: "1px solid var(--color-border)" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
        <span className={statusPillClass(complaint.status)}>{complaint.status_display}</span>
      </div>
      <ComplaintDetails complaint={complaint} showHousehold />

      {!isClosed && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {complaint.status === "open" && (
            <div>
              <button className="btn btn-outline" disabled={busy} onClick={() => run(() => startComplaintReview(complaint.id))}>
                Start review
              </button>
            </div>
          )}
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Response the resident will read (required)"
            maxLength={300}
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              className="btn btn-primary"
              disabled={busy || !notes.trim()}
              onClick={() => run(() => resolveComplaint(complaint.id, "resolved", notes))}
            >
              {isAppeal ? "Uphold appeal (marks check compliant, restores points)" : "Mark resolved"}
            </button>
            <button
              className="btn btn-accent"
              disabled={busy || !notes.trim()}
              onClick={() => run(() => resolveComplaint(complaint.id, "rejected", notes))}
            >
              {isAppeal ? "Reject appeal" : "Reject"}
            </button>
          </div>
        </div>
      )}
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}

function StaffQueue() {
  const [tab, setTab] = useState("active");
  const [wardInput, setWardInput] = useState("");
  const [ward, setWard] = useState("");
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setComplaints(await getComplaints(tab, ward));
    } catch (err) {
      setError("Couldn't load complaints. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tab, ward]);

  return (
    <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {STATUS_TABS.map(([value, label]) => (
          <button
            key={value}
            className={tab === value ? "btn btn-primary" : "btn btn-outline"}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); setWard(wardInput.trim()); }}
        style={{ display: "flex", gap: 8, marginBottom: 16 }}
      >
        <input
          type="number" min="1" max="29" value={wardInput}
          onChange={(e) => setWardInput(e.target.value)}
          placeholder="Filter by ward (blank = all)"
        />
        <button type="submit" className="btn btn-outline">Apply</button>
      </form>

      {error && <p style={{ color: "red" }}>{error}</p>}
      {loading && <p>Loading...</p>}
      {!loading && !error && (
        <div className="card">
          {complaints.length === 0 && <p>Nothing here.</p>}
          {complaints.map((c) => (
            <StaffComplaintCard key={c.id} complaint={c} onChanged={load} />
          ))}
        </div>
      )}
    </>
  );
}

/* ----------------------------------------------------------------- page */

function Complaints({ isStaff }) {
  return (
    <div className="page-container">
      <span className="eyebrow">{isStaff ? "STAFF" : "COMPLAINTS & APPEALS"}</span>
      <h2>{isStaff ? "Complaint queue" : "Complaints & appeals"}</h2>
      {isStaff ? <StaffQueue /> : <ResidentComplaints />}
    </div>
  );
}

export default Complaints;