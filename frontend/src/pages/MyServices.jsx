import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getServicePreferences, updateServicePreferences,
  getBulkPickups, requestBulkPickup, cancelBulkPickup,
} from "../api/premium";
import { PageHeader, Alert, Spinner, EmptyState, StatusPill, Field } from "../components/ui";
import { localIso, todayIso, formatDate } from "../lib/dates";
import { formatApiError } from "../lib/errors";

const WINDOW_OPTIONS = [
  ["", "No preference"],
  ["morning", "Morning (6–10 AM)"],
  ["midday", "Midday (10 AM–2 PM)"],
  ["afternoon", "Afternoon (2–6 PM)"],
];

function PerkRow({ unlocked, title, children }) {
  return (
    <div className="list-item align-start wrap-mobile">
      <div className="list-item-main">
        <p className="list-item-title">{title}</p>
        <p className="list-item-meta">{children}</p>
      </div>
      <span className={`pill ${unlocked ? "pill-success" : "pill-neutral"}`}>
        {unlocked ? "Included" : "Not in plan"}
      </span>
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

  const today = todayIso();
  const tomorrow = (() => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    return localIso(t);
  })();

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
      setPrefError(formatApiError(err, "Could not save preferences."));
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
      setPickupError(formatApiError(err, "Could not schedule the pickup."));
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
      setPickupError(formatApiError(err, "Could not cancel the pickup."));
    }
  };

  if (loading) return <div className="page-container"><Spinner /></div>;
  if (loadError) return <div className="page-container"><Alert kind="error">{loadError}</Alert></div>;
  if (noHousehold) {
    return (
      <div className="page-container">
        <div className="card">
          <EmptyState
            title="Register your household first"
            action={<Link to="/onboarding" className="btn btn-primary mt-sm">Start registration</Link>}
          >
            You need a registered household to use plan perks.
          </EmptyState>
        </div>
      </div>
    );
  }

  const noPerks = !features.assisted_segregation && !features.priority_pickup && !features.compost_addon
    && !features.monthly_compliance_report && features.bulk_credits_remaining === 0;

  return (
    <div className="page-container">
      <PageHeader eyebrow="My plan" title="Your plan perks" />

      <div className="stack-lg">
        {noPerks && (
          <div className="card band">
            <p style={{ marginTop: 0 }}>
              You're on the free plan. Paid plans unlock assisted segregation, priority pickup and more.
            </p>
            <Link to="/subscriptions" className="btn btn-primary">See plans</Link>
          </div>
        )}

        <div className="card">
          <div className="card-header"><span className="eyebrow">What's included</span></div>
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
            {features.monthly_compliance_report
              ? <Link to="/report">Open your report</Link>
              : "A printable summary of your month."}
          </PerkRow>
        </div>

        <div className="card">
          <div className="card-header"><span className="eyebrow">Pickup preferences</span></div>
          <div className="stack">
            <Field
              label="Priority pickup window"
              hint={!features.priority_pickup ? "Not in your current plan." : undefined}
            >
              <select
                value={prefs.priority_window}
                disabled={!features.priority_pickup && !prefs.priority_window}
                onChange={(e) => setPrefs({ ...prefs, priority_window: e.target.value })}
              >
                {WINDOW_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </Field>

            <div>
              <label className={`check-row${!features.compost_addon && !prefs.compost_pickup ? " is-disabled" : ""}`}>
                <input
                  type="checkbox"
                  checked={prefs.compost_pickup}
                  disabled={!features.compost_addon && !prefs.compost_pickup}
                  onChange={(e) => setPrefs({ ...prefs, compost_pickup: e.target.checked })}
                />
                Weekly compost pickup
              </label>
              {!features.compost_addon && <span className="field-hint">Not in your current plan.</span>}
            </div>

            <div className="actions actions-stack">
              <button className="btn btn-primary" onClick={handleSavePrefs}>Save preferences</button>
            </div>
          </div>
          <Alert kind="success">{prefMessage}</Alert>
          <Alert kind="error">{prefError}</Alert>
        </div>

        <div className="card">
          <div className="card-header"><span className="eyebrow">Bulk pickups</span></div>
          {features.bulk_credits_remaining > 0 ? (
            <form onSubmit={handleRequestPickup} className="stack">
              <Field label="Pickup date">
                <input type="date" value={pickupDate} min={tomorrow} onChange={(e) => setPickupDate(e.target.value)} required />
              </Field>
              <Field label="What should we collect?">
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. old sofa, renovation debris"
                  maxLength={300}
                  required
                />
              </Field>
              <div className="actions actions-stack">
                <button type="submit" className="btn btn-primary">Schedule (uses 1 credit)</button>
              </div>
            </form>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              You have no bulk pickup credits right now. <Link to="/subscriptions">Plans with credits</Link>
            </p>
          )}
          <Alert kind="success">{pickupMessage}</Alert>
          <Alert kind="error">{pickupError}</Alert>

          {pickups.length > 0 && (
            <div className="mt">
              {pickups.map((p) => (
                <div key={p.id} className="list-item wrap-mobile">
                  <div className="list-item-main">
                    <p className="list-item-title">{formatDate(p.pickup_date)}</p>
                    <p className="list-item-meta">{p.description}</p>
                    <div className="mt-sm"><StatusPill status={p.status} /></div>
                  </div>
                  {p.status === "scheduled" && p.pickup_date > today && (
                    <button className="btn btn-outline btn-sm" onClick={() => handleCancel(p.id)}>Cancel</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MyServices;