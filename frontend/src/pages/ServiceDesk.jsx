import { useEffect, useState } from "react";
import { getServiceLists, getBulkPickups, completeBulkPickup, cancelBulkPickup } from "../api/premium";

const WINDOW_LABELS = {
  morning: "Morning (6–10 AM)",
  midday: "Midday (10 AM–2 PM)",
  afternoon: "Afternoon (2–6 PM)",
};

function HouseholdList({ title, rows, showWindow }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <span className="eyebrow">{title}</span>
      {rows.length === 0 && <p>None.</p>}
      {rows.map((r) => (
        <div key={`${title}-${r.household_id}`} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--color-border)" }}>
          <span>Ward {r.ward_number} — House {r.house_number} · {r.owner_name}</span>
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
      setError(err.response?.data?.detail || "Could not load the service desk.");
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
      setError(err.response?.data?.detail || "Action failed.");
    }
  };

  return (
    <div className="page-container">
      <span className="eyebrow">STAFF</span>
      <h2>Service desk</h2>

      <form onSubmit={handleFilter} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          type="number" min="1" max="29" value={wardInput}
          onChange={(e) => setWardInput(e.target.value)}
          placeholder="Filter by ward (blank = all)"
        />
        <button type="submit" className="btn btn-outline">Apply</button>
      </form>

      {error && <p style={{ color: "red" }}>{error}</p>}
      {loading && <p>Loading...</p>}

      {lists && !loading && (
        <>
          <HouseholdList title="PRIORITY PICKUPS — COLLECT FIRST" rows={lists.priority} showWindow />
          <HouseholdList title="COMPOST PICKUPS" rows={lists.compost} />
          <HouseholdList title="ASSISTED SEGREGATION — SORT FOR THESE HOUSEHOLDS" rows={lists.assisted} />

          <div className="card">
            <span className="eyebrow">UPCOMING BULK PICKUPS</span>
            {pickups.length === 0 && <p>No bulk pickups scheduled.</p>}
            {pickups.map((p) => (
              <div key={p.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--color-border)" }}>
                <p style={{ margin: 0, fontWeight: 600 }}>
                  {new Date(p.pickup_date).toLocaleDateString()} · Ward {p.ward_number} — House {p.house_number} ({p.owner_name})
                </p>
                <p style={{ margin: "2px 0 8px" }}>{p.description}</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-primary" onClick={() => act(completeBulkPickup, p.id)}>Mark completed</button>
                  <button className="btn btn-accent" onClick={() => act(cancelBulkPickup, p.id)}>Cancel (refund credit)</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default ServiceDesk;