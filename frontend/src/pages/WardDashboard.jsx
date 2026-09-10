import { useEffect, useState, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { getWardComplianceStats } from "../api/wardStats";
import {
  getAllRoutes, createCollectorRoute, updateRouteStatus,
  updateRouteLocation, getMyRoutes, getStaffUsers,
} from "../api/collectorRoutes";
import LiveTruckMap from "../components/LiveTruckMap";

const WASTE_COLORS = { organic: "#1B4332", dry: "#C1652F", both: "#9CA3AF" };
const LOCATION_UPDATE_INTERVAL_MS = 20000;
const ACTIVE_STATUSES = ["assigned", "in_progress"];

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

function WardDashboard() {
  const [stats, setStats] = useState([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState("");

  const [routes, setRoutes] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [wardInput, setWardInput] = useState("");
  const [collectorInput, setCollectorInput] = useState("");
  const [routeError, setRouteError] = useState("");

  const [myRoutes, setMyRoutes] = useState([]);
  const [broadcastingIds, setBroadcastingIds] = useState({}); // { [routeId]: true }
  const [broadcastError, setBroadcastError] = useState("");
  const intervalsRef = useRef({}); // { [routeId]: intervalId }

  useEffect(() => {
    getWardComplianceStats()
      .then(setStats)
      .catch(() => setStatsError("Could not load ward stats — staff access required."))
      .finally(() => setStatsLoading(false));

    loadRoutes();
    getStaffUsers().then(setStaffList).catch(() => {});
    loadMyRoutes();

    return () => {
      Object.values(intervalsRef.current).forEach(clearInterval);
    };
  }, []);

  const loadRoutes = async () => {
    try {
      const data = await getAllRoutes();
      setRoutes(data.filter((r) => r.date === todayIso()));
    } catch (e) {
      console.error(e);
    }
  };

  const loadMyRoutes = async () => {
    try {
      const data = await getMyRoutes();
      setMyRoutes(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAssignRoute = async (e) => {
    e.preventDefault();
    setRouteError("");
    if (!wardInput || !collectorInput) {
      setRouteError("Ward number and collector are both required.");
      return;
    }
    try {
      await createCollectorRoute(wardInput, collectorInput, todayIso());
      setWardInput("");
      setCollectorInput("");
      loadRoutes();
      loadMyRoutes();
    } catch (err) {
      setRouteError(err.response?.data ? JSON.stringify(err.response.data) : "Could not assign route.");
    }
  };

  const stopBroadcasting = (routeId) => {
    if (intervalsRef.current[routeId]) {
      clearInterval(intervalsRef.current[routeId]);
      delete intervalsRef.current[routeId];
    }
    setBroadcastingIds((prev) => {
      const next = { ...prev };
      delete next[routeId];
      return next;
    });
  };

  const handleStatusChange = async (routeId, newStatus) => {
    try {
      await updateRouteStatus(routeId, newStatus);
      if (!ACTIVE_STATUSES.includes(newStatus)) {
        stopBroadcasting(routeId); // fixed leaving completed/missed intervals running 
      }
      loadRoutes();
      loadMyRoutes();
    } catch (e) {
      console.error(e);
    }
  };

  const sendLocationUpdate = (routeId) => {
    if (!navigator.geolocation) {
      setBroadcastError("Geolocation is not supported on this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const updated = await updateRouteLocation(
            routeId, position.coords.latitude, position.coords.longitude
          );
          setMyRoutes((prev) => prev.map((r) => (r.id === routeId ? updated : r)));
        } catch (e) {
          // Route is no longer active server-side 
          stopBroadcasting(routeId);
          setBroadcastError(e.response?.data?.detail || "Could not update location.");
        }
      },
      () => setBroadcastError("Location permission denied — cannot broadcast without it."),
      { enableHighAccuracy: true }
    );
  };

  const startBroadcasting = (routeId) => {
    setBroadcastError("");
    setBroadcastingIds((prev) => ({ ...prev, [routeId]: true }));
    sendLocationUpdate(routeId); // send one immediately
    intervalsRef.current[routeId] = setInterval(() => sendLocationUpdate(routeId), LOCATION_UPDATE_INTERVAL_MS);
  };

  if (statsLoading) return <div className="page-container"><p>Loading dashboard...</p></div>;

  const complianceChartData = stats.map((s) => ({
    ward: `Ward ${s.ward_number}`,
    "Compliant": s.compliant,
    "Non-Compliant": s.non_compliant,
  }));

  const wasteTypeTotals = stats.reduce(
    (acc, s) => { acc.organic += s.organic; acc.dry += s.dry; acc.both += s.both; return acc; },
    { organic: 0, dry: 0, both: 0 }
  );
  const wasteTypePieData = [
    { name: "Organic Only", value: wasteTypeTotals.organic, key: "organic" },
    { name: "Dry Only", value: wasteTypeTotals.dry, key: "dry" },
    { name: "Both Types", value: wasteTypeTotals.both, key: "both" },
  ].filter((d) => d.value > 0);

  return (
    <div className="page-container">
      <span className="eyebrow">WARD ADMIN</span>
      <h2>Compliance Dashboard</h2>

      {statsError && <p style={{ color: "red" }}>{statsError}</p>}

      {!statsError && stats.length === 0 && (
        <p>No reviewed compliance checks yet — charts will populate as reviews come in.</p>
      )}

      {!statsError && stats.length > 0 && (
        <>
          <div className="card" style={{ marginBottom: 20 }}>
            <span className="eyebrow">COMPLIANCE BY WARD</span>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={complianceChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="ward" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Compliant" fill="#1B4332" />
                <Bar dataKey="Non-Compliant" fill="#C1652F" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <span className="eyebrow">WASTE TYPE BREAKDOWN (ALL WARDS)</span>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={wasteTypePieData} dataKey="value" nameKey="name" outerRadius={100} label>
                  {wasteTypePieData.map((entry) => (
                    <Cell key={entry.key} fill={WASTE_COLORS[entry.key]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <span className="eyebrow">WARD DETAIL TABLE</span>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid var(--color-border)" }}>
                  <th style={{ padding: "8px 4px" }}>Ward</th>
                  <th style={{ padding: "8px 4px" }}>Checks</th>
                  <th style={{ padding: "8px 4px" }}>Compliance %</th>
                  <th style={{ padding: "8px 4px" }}>Total Weight (kg)</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.ward_number} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <td style={{ padding: "8px 4px" }}>Ward {s.ward_number}</td>
                    <td style={{ padding: "8px 4px" }}>{s.total}</td>
                    <td style={{ padding: "8px 4px" }}>{s.compliance_rate !== null ? `${s.compliance_rate}%` : "—"}</td>
                    <td style={{ padding: "8px 4px" }}>{s.total_weight_kg.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {myRoutes.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <span className="eyebrow">MY ASSIGNED ROUTES TODAY</span>
          {broadcastError && <p style={{ color: "red" }}>{broadcastError}</p>}
          {myRoutes.map((r) => (
            <div key={r.id} style={{ padding: "12px 0", borderBottom: "1px solid var(--color-border)" }}>
              <p style={{ fontWeight: 600, margin: "0 0 6px" }}>Ward {r.ward_number} — status: {r.status}</p>
              {ACTIVE_STATUSES.includes(r.status) && (
                <button
                  className={broadcastingIds[r.id] ? "btn btn-accent" : "btn btn-primary"}
                  onClick={() => (broadcastingIds[r.id] ? stopBroadcasting(r.id) : startBroadcasting(r.id))}
                >
                  {broadcastingIds[r.id] ? "Stop Broadcasting Location" : "Start Broadcasting Location"}
                </button>
              )}
              {r.current_lat && r.current_lng && (
                <div style={{ marginTop: 12 }}>
                  <LiveTruckMap lat={r.current_lat} lng={r.current_lng} label={`Ward ${r.ward_number}`} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <span className="eyebrow">ASSIGN TODAY'S ROUTE</span>
        <form onSubmit={handleAssignRoute} style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <input
            value={wardInput}
            onChange={(e) => setWardInput(e.target.value)}
            placeholder="Ward number"
            type="number"
            min="1"
            max="29"
            style={{ flex: "1 1 120px" }}
          />
          <select value={collectorInput} onChange={(e) => setCollectorInput(e.target.value)} style={{ flex: "1 1 160px" }}>
            <option value="">Select collector</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>{s.username}</option>
            ))}
          </select>
          <button type="submit" className="btn btn-primary">Assign</button>
        </form>
        {routeError && <p style={{ color: "red" }}>{routeError}</p>}
      </div>

      <div className="card">
        <span className="eyebrow">TODAY'S ROUTES</span>
        {routes.length === 0 && <p>No routes assigned today.</p>}
        {routes.map((r) => (
          <div key={r.id} style={{ padding: "12px 0", borderBottom: "1px solid var(--color-border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div>
                <p style={{ margin: 0, fontWeight: 600 }}>Ward {r.ward_number} — {r.collector_username}</p>
                <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-muted)" }}>
                  Status: {r.status}
                  {r.last_location_update && ` · Last update: ${new Date(r.last_location_update).toLocaleTimeString()}`}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {r.status === "assigned" && (
                  <button className="btn btn-outline" onClick={() => handleStatusChange(r.id, "in_progress")}>Start</button>
                )}
                {r.status === "in_progress" && (
                  <button className="btn btn-primary" onClick={() => handleStatusChange(r.id, "completed")}>Complete</button>
                )}
                {ACTIVE_STATUSES.includes(r.status) && (
                  <button className="btn btn-accent" onClick={() => handleStatusChange(r.id, "missed")}>Mark Missed</button>
                )}
              </div>
            </div>
            {r.current_lat && r.current_lng && (
              <div style={{ marginTop: 8 }}>
                <LiveTruckMap lat={r.current_lat} lng={r.current_lng} label={`${r.collector_username} — Ward ${r.ward_number}`} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default WardDashboard;