import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getServicePreferences, updateServicePreferences,
  getBulkPickups, requestBulkPickup, cancelBulkPickup,
} from "../api/premium";

const WINDOW_OPTIONS = [
  ["", "No preference"],
  ["morning", "Morning (6–10 AM)"],
  ["midday", "Midday (10 AM–2 PM)"],
  ["afternoon", "Afternoon (2–6 PM)"],
];

function localIso(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function errorText(err, fallback) {
  const data = err.response?.data;
  if (data?.detail) return data.detail;
  if (data) return JSON.stringify(data);
  return fallback;
}

function PerkRow({ unlocked, title, children }) {
  return (
    <div style={{ padding: "10px 0", borderBottom: "1px solid var(--color-border)" }}>
      <p style={{ margin: 0, fontWeight: 600 }}>
        {unlocked ? "✓ " : "🔒 "}{title}
      </p>
      <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--color-text-muted)" }}>{children}</p>
    </div>
  );
}

function MyServices() {
  const [prefs, setPrefs] = useState(null);
  const [features, setFeatures] = useState(null);
  const [pickups, setPickups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noHousehold, setNoHousehold] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [prefMessage, setPrefMessage] = useState("");
  const [prefError, setPrefError] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [description, setDescription] = useState("");
  const [pickupMessage, setPickupMessage] = useState("");
  const [pickupError, setPickupError] = useState("");

  const tomorrow = (() => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    return localIso(t);
  })();
  const today = localIso(new Date());

  const load = async () => {
    try {
      const [prefData, pickupData] = await Promise.all([getServicePreferences(), getBulkPickups()]);
      setPrefs({ priority_window: prefData.priority_window, compost_pickup: prefData.compost_pickup });
      setFeatures(prefData.features);
      setPickups(pickupData);
    } catch (err) {
      if (err.response?.status === 400) setNoHousehold(true);
      else setLoadError("Couldn't load your plan perks. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSavePrefs = async () => {
    setPrefMessage("");
    setPrefError("");
    try {
      const data = await updateServicePreferences(prefs.priority_window, prefs.compost_pickup);
      setPrefs({ priority_window: data.priority_window, compost_pickup: data.compost_pickup });
      setFeatures(data.features);
      setPrefMessage("Preferences saved.");
    } catch (err) {
      setPrefError(errorText(err, "Could not save preferences."));
    }
  };

  const handleRequestPickup = async (e) => {
    e.preventDefault();
    setPickupMessage("");
    setPickupError("");
    try {
      await requestBulkPickup(pickupDate, description);
      setPickupMessage("Bulk pickup scheduled. One credit was used.");
      setPickupDate("");
      setDescription("");
      load();
    } catch (err) {
      setPickupError(errorText(err, "Could not schedule the pickup."));
    }
  };

  const handleCancel = async (id) => {
    setPickupMessage("");
    setPickupError("");
    try {
      await cancelBulkPickup(id);
      setPickupMessage("Pickup cancelled and your credit was refunded.");
      load();
    } catch (err) {
      setPickupError(errorText(err, "Could not cancel the pickup."));
    }
  };

  if (loading) return <div className="page-container"><p>Loading...</p></div>;
  if (loadError) return <div className="page-container"><p style={{ color: "red" }}>{loadError}</p></div>;
  if (noHousehold) {
    return (
      <div className="page-container">
        <p>Register your household first to use plan perks.</p>
        <Link to="/onboarding" className="btn btn-primary">Start Registration →</Link>
      </div>
    );
  }

  const noPerks = !features.assisted_segregation && !features.priority_pickup && !features.compost_addon
    && !features.monthly_compliance_report && features.bulk_credits_remaining === 0;

  return (
    <div className="page-container">
      <span className="eyebrow">MY PLAN</span>
      <h2>Your plan perks</h2>

      {noPerks && (
        <div className="card" style={{ marginBottom: 16 }}>
          <p style={{ marginTop: 0 }}>You're on the free plan. Paid plans unlock assisted segregation, priority pickup and more.</p>
          <Link to="/subscriptions" className="btn btn-primary">See plans →</Link>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <span className="eyebrow">WHAT'S INCLUDED</span>
        <PerkRow unlocked={features.assisted_segregation} title="Assisted segregation">
          Collectors sort your waste for you. Compliant checks earn 5 points and failed checks never cost you points.
        </PerkRow>
        <PerkRow unlocked={features.priority_pickup} title="Priority pickup">
          Choose a preferred time window on your ward's pickup day.
        </PerkRow>
        <PerkRow unlocked={features.compost_addon} title="Compost pickup">
          Weekly compost collection for your organic waste.
        </PerkRow>
        <PerkRow unlocked={features.bulk_credits_remaining > 0} title="Bulk pickup credits">
          {features.bulk_credits_remaining > 0
            ? `${features.bulk_credits_remaining} credit${features.bulk_credits_remaining === 1 ? "" : "s"} left in your current plan.`
            : "Book one-off large-waste pickups like furniture or renovation debris."}
        </PerkRow>
        <PerkRow unlocked={features.monthly_compliance_report} title="Monthly compliance report">
          {features.monthly_compliance_report ? <Link to="/report">Open your report →</Link> : "A printable summary of your month."}
        </PerkRow>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <span className="eyebrow">PICKUP PREFERENCES</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
          <label>
            Priority pickup window
            <select
              value={prefs.priority_window}
              disabled={!features.priority_pickup && !prefs.priority_window}
              onChange={(e) => setPrefs({ ...prefs, priority_window: e.target.value })}
              style={{ display: "block", marginTop: 4 }}
            >
              {WINDOW_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            {!features.priority_pickup && <small style={{ color: "var(--color-text-muted)" }}>Not in your current plan.</small>}
          </label>
          <label>
            <input
              type="checkbox"
              checked={prefs.compost_pickup}
              disabled={!features.compost_addon && !prefs.compost_pickup}
              onChange={(e) => setPrefs({ ...prefs, compost_pickup: e.target.checked })}
            />{" "}
            Weekly compost pickup
            {!features.compost_addon && <small style={{ color: "var(--color-text-muted)" }}> — not in your current plan.</small>}
          </label>
          <div><button className="btn btn-primary" onClick={handleSavePrefs}>Save preferences</button></div>
        </div>
        {prefMessage && <p style={{ color: "var(--color-primary)" }}>{prefMessage}</p>}
        {prefError && <p style={{ color: "red" }}>{prefError}</p>}
      </div>

      <div className="card">
        <span className="eyebrow">BULK PICKUPS</span>
        {features.bulk_credits_remaining > 0 ? (
          <form onSubmit={handleRequestPickup} style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
            <input type="date" value={pickupDate} min={tomorrow} onChange={(e) => setPickupDate(e.target.value)} required />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What should we collect? (e.g. old sofa, renovation debris)"
              maxLength={300}
              required
            />
            <button type="submit" className="btn btn-primary">Schedule (uses 1 credit)</button>
          </form>
        ) : (
          <p style={{ color: "var(--color-text-muted)" }}>
            You have no bulk pickup credits right now. <Link to="/subscriptions">Plans with credits →</Link>
          </p>
        )}
        {pickupMessage && <p style={{ color: "var(--color-primary)" }}>{pickupMessage}</p>}
        {pickupError && <p style={{ color: "red" }}>{pickupError}</p>}

        {pickups.length > 0 && (
          <div style={{ marginTop: 16 }}>
            {pickups.map((p) => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "10px 0", borderBottom: "1px solid var(--color-border)" }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600 }}>{new Date(p.pickup_date).toLocaleDateString()} — {p.description}</p>
                  <span className={p.status === "completed" ? "pill pill-success" : p.status === "cancelled" ? "pill pill-neutral" : "pill pill-warning"}>
                    {p.status}
                  </span>
                </div>
                {p.status === "scheduled" && p.pickup_date > today && (
                  <button className="btn btn-outline" onClick={() => handleCancel(p.id)}>Cancel</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default MyServices;