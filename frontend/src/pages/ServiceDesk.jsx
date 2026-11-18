import { useEffect, useState } from "react";
import { getServiceLists, getBulkPickups, completeBulkPickup, cancelBulkPickup } from "../api/premium";
import { PageHeader, Alert, Spinner, EmptyState } from "../components/ui";
import { formatDate } from "../lib/dates";
import { formatApiError } from "../lib/errors";

const WINDOW_LABELS = {
  morning: "Morning (6–10 AM)",
  midday: "Midday (10 AM–2 PM)",
  afternoon: "Afternoon (2–6 PM)",
};

function HouseholdList({ title, rows, showWindow }) {
  return (
    <div className="card">
      <div className="card-header"><span className="eyebrow">{title}</span></div>
      {rows.length === 0 && <p className="muted" style={{ margin: 0 }}>None.</p>}
      {rows.map((r) => (
        <div key={`${title}-${r.household_id}`} className="list-item wrap-mobile">
          <div className="list-item-main">
            <p className="list-item-title">Ward {r.ward_number} · House {r.house_number}</p>
            <p className="list-item-meta">{r.owner_name}</p>
          </div>
          {showWindow && <span className="pill pill-neutral">{WINDOW_LABELS[r.priority_window]}</span>}
        </div>
      ))}
    </div>
  );
}

function ServiceDesk() {
  const [wardInput, setWardInput] = useState("");
  const [ward, setWard] = useState("");
  const [lists, setLists] = useState(null);
  const [pickups, setPickups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async (wardFilter) => {
    setLoading(true);
    setError("");
    try {
      const [listData, pickupData] = await Promise.all([getServiceLists(wardFilter), getBulkPickups(wardFilter)]);
      setLists(listData);
      setPickups(pickupData);
    } catch (err) {
      setError(formatApiError(err, "Could not load the service desk."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(ward); }, [ward]);

  const handleFilter = (e) => {
    e.preventDefault();
    setWard(wardInput.trim());
  };

  const act = async (fn, id) => {
    try {
      await fn(id);
      load(ward);
    } catch (err) {
      setError(formatApiError(err, "Action failed."));
    }
  };

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Staff"
        title="Service desk"
        subtitle="Households with paid-plan perks, and upcoming bulk pickups."
      />

      <form onSubmit={handleFilter} className="scan-row mb">
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

      {lists && !loading && (
        <div className="stack-lg">
          <HouseholdList title="Priority pickups: collect first" rows={lists.priority} showWindow />
          <HouseholdList title="Compost pickups" rows={lists.compost} />
          <HouseholdList title="Assisted segregation: sort for these households" rows={lists.assisted} />

          <div className="card">
            <div className="card-header"><span className="eyebrow">Upcoming bulk pickups</span></div>
            {pickups.length === 0 && (
              <EmptyState title="No bulk pickups scheduled" />
            )}
            {pickups.map((p) => (
              <div key={p.id} className="list-item align-start wrap-mobile">
                <div className="list-item-main">
                  <p className="list-item-title">
                    {formatDate(p.pickup_date)} · Ward {p.ward_number}, House {p.house_number}
                  </p>
                  <p className="list-item-meta">{p.owner_name}</p>
                  <p style={{ margin: "6px 0 0" }}>{p.description}</p>
                </div>
                <div className="actions actions-stack">
                  <button className="btn btn-primary btn-sm" onClick={() => act(completeBulkPickup, p.id)}>Mark completed</button>
                  <button className="btn btn-accent btn-sm" onClick={() => act(cancelBulkPickup, p.id)}>Cancel (refund credit)</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ServiceDesk;