import { useEffect, useRef, useState } from "react";
import {
  createComplianceCheck, getPendingReviews, lookupHousehold, reviewComplianceCheck,
} from "../api/compliance";
import CameraCapture from "../components/CameraCapture";
import QrScanner from "../components/QrScanner";
import { Alert, EmptyState, Field, PageHeader, StatusPill } from "../components/ui";
import { formatApiError } from "../lib/errors";
import PhotoGallery from "../components/PhotoGallery";

const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

const STATUS_LABELS = {
  compliant: "Compliant",
  non_compliant: "Non-compliant",
  pending_review: "Pending review",
};
const WASTE_LABELS = { organic: "Organic", dry: "Dry", both: "Mixed" };
const WINDOW_LABELS = { morning: "Morning", midday: "Midday", afternoon: "Afternoon" };

function HouseholdPanel({ household, onClear }) {
  const { perks, compliance } = household;
  const hasPerks = perks.assisted_segregation || perks.priority_window || perks.compost_pickup;

  return (
    <div className="card mb">
      <div className="card-header">
        <span className="eyebrow">Household</span>
        <button type="button" className="btn btn-outline btn-sm" onClick={onClear}>Change</button>
      </div>

      <h3 style={{ marginBottom: 2 }}>{household.owner_name}</h3>
      <p className="muted" style={{ marginBottom: 0 }}>
        Ward {household.ward_number} · House {household.house_number}
        {household.phone_number && <> · <a href={`tel:${household.phone_number}`}>{household.phone_number}</a></>}
      </p>

      <div className="perk-pills">
        {household.plan ? <span className="pill pill-success">{household.plan}</span> : <span className="pill pill-neutral">Free plan</span>}
        {perks.priority_window && <span className="pill pill-neutral">Priority: {WINDOW_LABELS[perks.priority_window] || perks.priority_window}</span>}
        {perks.compost_pickup && <span className="pill pill-neutral">Compost pickup</span>}
        {!hasPerks && household.plan && <span className="pill pill-neutral">No extra perks</span>}
      </div>

      {perks.assisted_segregation && (
        <Alert kind="warning">
          Assisted segregation: sort this household's waste for them. They earn fewer points and never lose any.
        </Alert>
      )}

      <div className="facts">
        <div className="fact"><p className="value">{household.points}</p><p className="label">GreenPoints · {household.tier}</p></div>
        <div className="fact"><p className="value">{compliance.rate !== null ? `${compliance.rate}%` : "—"}</p><p className="label">Compliance rate</p></div>
        <div className="fact"><p className="value">{compliance.pending}</p><p className="label">Awaiting review</p></div>
        <div className="fact"><p className="value">{household.open_complaints}</p><p className="label">Open complaints</p></div>
      </div>

      {household.recent_checks.length > 0 && (
        <div className="mt">
          <span className="eyebrow">Recent checks</span>
          {household.recent_checks.map((c) => (
            <div key={c.id} className="list-item wrap-mobile">
              <div className="list-item-main">
                <p className="list-item-title">
                  {new Date(c.checked_at).toLocaleDateString()} · {WASTE_LABELS[c.waste_type] || c.waste_type}, {c.weight_kg} kg
                </p>
              </div>
              <StatusPill status={c.status}>{STATUS_LABELS[c.status] || c.status}</StatusPill>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Compliance() {
  // Step 1: find the household
  const [ward, setWard] = useState("");
  const [house, setHouse] = useState("");
  const [household, setHousehold] = useState(null);
  const [finding, setFinding] = useState(false);
  const [findError, setFindError] = useState("");
  const [scanning, setScanning] = useState(false);
  const houseRef = useRef(null);

  // Step 2: record the check
  const [photos, setPhotos] = useState([]);
  const [photoError, setPhotoError] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [wasteType, setWasteType] = useState("both");
  const [weightKg, setWeightKg] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  const photosRef = useRef(photos);
  photosRef.current = photos;

  // Review queue
  const [pending, setPending] = useState([]);
  const [pendingError, setPendingError] = useState("");
  const [busyReviewId, setBusyReviewId] = useState(null);

  const loadPending = async () => {
    setPendingError("");
    try {
      setPending(await getPendingReviews());
    } catch (e) {
      setPendingError(formatApiError(e, "Couldn't load the review queue."));
    }
  };

  useEffect(() => { loadPending(); }, []);
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  /* ----------------------------------------------------------- find */

  const find = async (params) => {
    setFindError("");
    setMessage("");
    setFinding(true);
    try {
      const result = await lookupHousehold(params);
      setHousehold(result);
      if (params.qr) {
        setWard(String(result.ward_number));
        setHouse(result.house_number);
      }
    } catch (err) {
      setHousehold(null);
      setFindError(formatApiError(err, "Could not find that household."));
    } finally {
      setFinding(false);
    }
  };

  const handleFind = (e) => {
    e.preventDefault();
    find({ ward: ward.trim(), house: house.trim() });
  };

  const handleScan = (code) => {
    setScanning(false);
    find({ qr: code });
  };

  const clearHousehold = () => {
    setHousehold(null);
    houseRef.current?.focus();
  };

  /* --------------------------------------------------------- photos */

  const addFiles = (fileList) => {
    const current = photosRef.current;
    const added = [];
    let problem = "";

    for (const file of Array.from(fileList || [])) {
      if (current.length + added.length >= MAX_PHOTOS) { problem = `You can add up to ${MAX_PHOTOS} photos.`; break; }
      if (!file.type.startsWith("image/")) { problem = "Only image files can be added."; continue; }
      if (file.size > MAX_PHOTO_BYTES) { problem = "Each photo must be under 10 MB."; continue; }
      added.push({
        id: `${file.name}-${file.size}-${Date.now()}-${added.length}`,
        file,
        url: URL.createObjectURL(file),
      });
    }
    setPhotoError(problem);
    if (added.length) setPhotos([...current, ...added]);
  };

  const removePhoto = (id) => {
    const target = photosRef.current.find((p) => p.id === id);
    if (target) URL.revokeObjectURL(target.url);
    setPhotos(photosRef.current.filter((p) => p.id !== id));
    setPhotoError("");
  };

  /* --------------------------------------------------------- submit */

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!household) { setError("Find a household first."); return; }
    if (photos.length === 0) { setError("Add at least one photo."); return; }
    if (!weightKg || Number(weightKg) <= 0) { setError("Enter the weight in kg."); return; }

    setSubmitting(true);
    try {
      await createComplianceCheck({
        householdId: household.id,
        photos: photos.map((p) => p.file),
        wasteType,
        weightKg,
        notes,
      });
      setMessage(`Check submitted for Ward ${household.ward_number}, House ${household.house_number}. It's waiting for review.`);
      photos.forEach((p) => URL.revokeObjectURL(p.url));
      setPhotos([]);
      setWeightKg("");
      setNotes("");
      setWasteType("both");
      setHousehold(null);
      setHouse("");           // keep the ward, ready for the next house
      loadPending();
      houseRef.current?.focus();
    } catch (err) {
      setError(formatApiError(err, "Submission failed. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async (id, decision) => {
    setBusyReviewId(id);
    setPendingError("");
    try {
      await reviewComplianceCheck(id, decision);
      await loadPending();
    } catch (err) {
      setPendingError(formatApiError(err, "Could not save the review."));
    } finally {
      setBusyReviewId(null);
    }
  };

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="STAFF"
        title="Check desk"
        subtitle="Find the household, take photos and record the weight."
      />

      <Alert kind="success">{message}</Alert>

      {scanning && <QrScanner onScan={handleScan} onClose={() => setScanning(false)} />}
      {cameraOpen && (
        <CameraCapture
          count={photos.length}
          max={MAX_PHOTOS}
          onCapture={(file) => addFiles([file])}
          onClose={() => setCameraOpen(false)}
        />
      )}

      <div className="card mb">
        <div className="card-header"><span className="eyebrow">1. Find the household</span></div>
        <form onSubmit={handleFind} className="stack">
          <div className="scan-row">
            <input
              type="number" min="1" max="29" inputMode="numeric"
              value={ward} onChange={(e) => setWard(e.target.value)}
              placeholder="Ward" aria-label="Ward number" required
            />
            <input
              ref={houseRef}
              value={house} onChange={(e) => setHouse(e.target.value)}
              placeholder="House no." aria-label="House number" autoComplete="off" required
              style={{ flex: 2 }}
            />
            <button type="submit" className="btn btn-primary" disabled={finding}>
              {finding ? "..." : "Find"}
            </button>
          </div>
          <button type="button" className="btn btn-outline" onClick={() => setScanning(true)}>
            📷 Scan household QR
          </button>
        </form>
        <Alert kind="error">{findError}</Alert>
      </div>

      {household && <HouseholdPanel household={household} onClear={clearHousehold} />}

      {household && (
        <div className="card mb">
          <div className="card-header"><span className="eyebrow">2. Record the check</span></div>
          <form onSubmit={handleSubmit} className="stack">
            <div className="field">
              <span className="field-label">Photos of the waste ({photos.length} of {MAX_PHOTOS})</span>
              <div className="actions">
                <button
                  type="button" className="btn btn-outline"
                  onClick={() => setCameraOpen(true)} disabled={photos.length >= MAX_PHOTOS}
                >
                  📷 Take photo
                </button>
                <button
                  type="button" className="btn btn-outline"
                  onClick={() => fileInputRef.current?.click()} disabled={photos.length >= MAX_PHOTOS}
                >
                  Choose files
                </button>
                <input
                  ref={fileInputRef} type="file" accept="image/*" multiple hidden
                  onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
                />
              </div>
              <span className="field-hint">Clear photos of the bags, with the colours visible.</span>
              {photoError && <span className="field-error">{photoError}</span>}
            </div>

            {photos.length > 0 && (
              <div className="photo-grid">
                {photos.map((p) => (
                  <div key={p.id} className="photo-item">
                    <img src={p.url} alt="Selected waste" />
                    <button type="button" className="photo-remove" aria-label="Remove photo" onClick={() => removePhoto(p.id)}>×</button>
                  </div>
                ))}
              </div>
            )}

            <Field label="Waste type">
              <select value={wasteType} onChange={(e) => setWasteType(e.target.value)}>
                <option value="organic">Organic only</option>
                <option value="dry">Dry only</option>
                <option value="both">Both types</option>
              </select>
            </Field>

            <Field label="Weight (kg)">
              <input
                value={weightKg} onChange={(e) => setWeightKg(e.target.value)}
                placeholder="e.g. 3.5" type="number" step="0.01" min="0" inputMode="decimal"
              />
            </Field>

            <Field label="Notes (optional)">
              <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} placeholder="Anything the reviewer should know" />
            </Field>

            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit check"}
            </button>
          </form>
          <Alert kind="error">{error}</Alert>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="eyebrow">Pending review</span>
          {pending.length > 0 && <span className="pill pill-warning">{pending.length} waiting</span>}
        </div>
        <Alert kind="error">{pendingError}</Alert>

        {pending.length === 0 && !pendingError && (
          <EmptyState icon="check" title="All caught up">Nothing is waiting for review.</EmptyState>
        )}

        {pending.map((p) => (
          <div key={p.id} className="list-item align-start wrap-mobile">
            <div className="list-item-main">
              <p className="list-item-title">
                Ward {p.ward_number} · House {p.house_number} · {p.owner_name}
              </p>
              <p className="list-item-meta">
                {WASTE_LABELS[p.waste_type] || p.waste_type} · {p.weight_kg} kg · {new Date(p.checked_at).toLocaleString()}
              </p>
              {p.notes && <p className="list-item-meta">Notes: {p.notes}</p>}

              <div className="mt-sm">
                <PhotoGallery urls={p.photo_urls} alt="Waste photo" />
              </div>

              <div className="actions actions-stack mt-sm">
                <button className="btn btn-primary btn-sm" disabled={busyReviewId === p.id} onClick={() => handleReview(p.id, "compliant")}>
                  Mark compliant
                </button>
                <button className="btn btn-accent btn-sm" disabled={busyReviewId === p.id} onClick={() => handleReview(p.id, "non_compliant")}>
                  Mark non-compliant
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Compliance;