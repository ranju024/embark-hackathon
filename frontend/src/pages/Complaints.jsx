import { useEffect, useState } from "react";
import {
  getComplaints, getAppealableChecks, fileComplaint,
  startComplaintReview, resolveComplaint,
} from "../api/complaints";
import { Alert, EmptyState, Field, PageHeader, Spinner, StatusPill } from "../components/ui";
import { formatApiError } from "../lib/errors";
import PhotoGallery from "../components/PhotoGallery";

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

function ComplaintDetails({ complaint }) {
  return (
    <>
      <p style={{ marginBottom: 6 }}>{complaint.description}</p>
      {complaint.check_summary && (
        <p className="list-item-meta">
          Appeal against the {new Date(complaint.check_summary.date).toLocaleDateString()} check:{" "}
          {complaint.check_summary.waste_type}, {complaint.check_summary.weight_kg.toFixed(2)} kg, marked{" "}
          {complaint.check_summary.status.replace("_", " ")}.
        </p>
      )}
      {complaint.photo && (
        <div className="mt-sm">
          <PhotoGallery urls={[complaint.photo]} size={140} alt="Complaint evidence" />
        </div>
      )}
      {complaint.resolution_notes && (
        <div className="callout">
          <strong>Officer's response{complaint.handled_by_username ? ` (${complaint.handled_by_username})` : ""}:</strong>{" "}
          {complaint.resolution_notes}
        </div>
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

  if (loading) return <Spinner />;
  if (loadError) return <Alert kind="error">{loadError}</Alert>;

  const isAppeal = category === "appeal";

  return (
    <div className="stack-lg">
      <div className="card">
        <div className="card-header">
          <span className="eyebrow">File a complaint or appeal</span>
        </div>
        <form onSubmit={handleSubmit} className="stack">
          <Field label="What is this about?">
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORY_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </Field>

          {isAppeal && (
            appealable.length > 0 ? (
              <Field label="Result to appeal" hint="You can appeal within 7 days of the officer's review.">
                <select value={checkId} onChange={(e) => setCheckId(e.target.value)} required>
                  <option value="">Select a result</option>
                  {appealable.map((c) => (
                    <option key={c.id} value={c.id}>
                      {new Date(c.checked_on).toLocaleDateString()} · {c.waste_type}, {c.weight_kg.toFixed(2)} kg
                      (appeal by {new Date(c.appeal_deadline).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <Alert kind="info">
                No results can be appealed right now. You can appeal a non-compliant result within 7 days of it being reviewed.
              </Alert>
            )
          )}

          <Field
            label={isAppeal ? "Why should this result change?" : "Describe the problem"}
            hint="At least 10 characters."
          >
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={1000}
              required
            />
          </Field>

          <Field label="Photo (optional)" hint="Up to 5 MB.">
            <input key={fileKey} type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files[0] || null)} />
          </Field>

          <button type="submit" className="btn btn-primary" disabled={submitting || (isAppeal && appealable.length === 0)}>
            {submitting ? "Submitting..." : "Submit"}
          </button>
        </form>
        <Alert kind="success">{message}</Alert>
        <Alert kind="error">{error}</Alert>
      </div>

      <div>
        <h3>Your complaints</h3>
        {complaints.length === 0 ? (
          <div className="card">
            <EmptyState icon="check" title="Nothing filed">You haven't filed any complaints.</EmptyState>
          </div>
        ) : (
          <div className="stack">
            {complaints.map((c) => (
              <div key={c.id} className="card">
                <div className="card-header">
                  <div>
                    <p className="list-item-title">{c.category_display}</p>
                    <p className="list-item-meta">Filed {new Date(c.created_at).toLocaleDateString()}</p>
                  </div>
                  <StatusPill status={c.status}>{c.status_display}</StatusPill>
                </div>
                <ComplaintDetails complaint={c} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
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
    <div className="card">
      <div className="card-header">
        <div>
          <p className="list-item-title">Ward {complaint.ward_number} — House {complaint.house_number}</p>
          <p className="list-item-meta">
            {complaint.owner_name} · {complaint.category_display} · {new Date(complaint.created_at).toLocaleDateString()}
          </p>
        </div>
        <StatusPill status={complaint.status}>{complaint.status_display}</StatusPill>
      </div>

      <ComplaintDetails complaint={complaint} />

      {!isClosed && (
        <div className="stack mt">
          {complaint.status === "open" && (
            <div className="actions">
              <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => run(() => startComplaintReview(complaint.id))}>
                Start review
              </button>
            </div>
          )}
          <Field label="Your response" hint="The resident will read this. It's required to close the complaint.">
            <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} />
          </Field>
          <div className="actions actions-stack">
            <button
              className="btn btn-primary"
              disabled={busy || !notes.trim()}
              onClick={() => run(() => resolveComplaint(complaint.id, "resolved", notes))}
            >
              {isAppeal ? "Uphold appeal" : "Mark resolved"}
            </button>
            <button
              className="btn btn-accent"
              disabled={busy || !notes.trim()}
              onClick={() => run(() => resolveComplaint(complaint.id, "rejected", notes))}
            >
              {isAppeal ? "Reject appeal" : "Reject"}
            </button>
          </div>
          {isAppeal && (
            <small className="muted">
              Upholding an appeal marks the check compliant and restores the household's points.
            </small>
          )}
        </div>
      )}
      <Alert kind="error">{error}</Alert>
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
      <div className="tabs" role="tablist" aria-label="Complaint status">
        {STATUS_TABS.map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            className={`chip${tab === value ? " active" : ""}`}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); setWard(wardInput.trim()); }} className="scan-row mb">
        <input
          type="number" min="1" max="29" value={wardInput}
          onChange={(e) => setWardInput(e.target.value)}
          placeholder="Filter by ward (blank = all)"
          aria-label="Filter by ward"
        />
        <button type="submit" className="btn btn-outline">Apply</button>
      </form>

      <Alert kind="error">{error}</Alert>
      {loading && <Spinner />}
      {!loading && !error && (
        complaints.length === 0 ? (
          <div className="card">
            <EmptyState icon="check" title="Nothing here">No complaints match this filter.</EmptyState>
          </div>
        ) : (
          <div className="stack">
            {complaints.map((c) => (
              <StaffComplaintCard key={c.id} complaint={c} onChanged={load} />
            ))}
          </div>
        )
      )}
    </>
  );
}

/* ----------------------------------------------------------------- page */

function Complaints({ isStaff }) {
  return (
    <div className="page-container">
      <PageHeader
        eyebrow={isStaff ? "STAFF" : "COMPLAINTS & APPEALS"}
        title={isStaff ? "Complaint queue" : "Complaints & appeals"}
        subtitle={isStaff ? "Review complaints, then resolve or reject them with a note." : "Tell us about a problem, or appeal a compliance result."}
      />
      {isStaff ? <StaffQueue /> : <ResidentComplaints />}
    </div>
  );
}

export default Complaints;