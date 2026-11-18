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
import { PageHeader, Alert, Spinner, EmptyState, StatusPill, Field, Stat, TableScroll } from "../components/ui";
import { todayIso } from "../lib/dates";
import { formatApiError } from "../lib/errors";

// recharts needs real colour values, so these mirror the CSS palette
const COLOR_PRIMARY = "#14452f";
const COLOR_ACCENT = "#b8521f";
const WASTE_COLORS = { organic: COLOR_PRIMARY, dry: COLOR_ACCENT, both: "#9CA3AF" };
const LOCATION_UPDATE_INTERVAL_MS = 20000;
const ACTIVE_STATUSES = ["assigned", "in_progress"];

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
      .catch(() => setStatsError("Could not load ward stats. Staff access is required."))
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
      setRouteError(formatApiError(err, "Could not assign route."));
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
        stopBroadcasting(routeId); // don't leave intervals running on completed/missed routes
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
          // Route is no longer active server-side (e.g. completed from another
          // tab/device): stop this interval instead of failing repeatedly.
          stopBroadcasting(routeId);
          setBroadcastError(e.response?.data?.detail || "Could not update location.");
        }
      },
      () => setBroadcastError("Location permission denied. Cannot broadcast without it."),
      { enableHighAccuracy: true }
    );
  };

  const startBroadcasting = (routeId) => {
    setBroadcastError("");
    setBroadcastingIds((prev) => ({ ...prev, [routeId]: true }));
    sendLocationUpdate(routeId); // send one immediately
    intervalsRef.current[routeId] = setInterval(() => sendLocationUpdate(routeId), LOCATION_UPDATE_INTERVAL_MS);
  };

  if (statsLoading) {
    return (
      <div className="page-container">
        <Spinner label="Loading dashboard..." />
      </div>
    );
  }

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

  const totalChecks = stats.reduce((sum, s) => sum + s.total, 0);
  const totalWeight = stats.reduce((sum, s) => sum + Number(s.total_weight_kg || 0), 0);

  return (
    <div className="page-container">
      <PageHeader eyebrow="Ward admin" title="Compliance dashboard" />

      <Alert kind="error">{statsError}</Alert>

      {!statsError && stats.length === 0 && (
        <div className="card">
          <EmptyState title="No reviewed checks yet">
            Charts will fill in as compliance checks get reviewed.
          </EmptyState>
        </div>
      )}

      {!statsError && stats.length > 0 && (
        <div className="stack-lg">
          <div className="stat-grid">
            <Stat value={stats.length} label="Wards reporting" />
            <Stat value={totalChecks} label="Reviewed checks" />
            <Stat value={totalWeight.toFixed(1)} label="Total kg collected" />
            <Stat value={routes.length} label="Routes today" />
          </div>

          <div className="card">
            <div className="card-header"><span className="eyebrow">Compliance by ward</span></div>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={complianceChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="ward" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Compliant" fill={COLOR_PRIMARY} />
                <Bar dataKey="Non-Compliant" fill={COLOR_ACCENT} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <div className="card-header"><span className="eyebrow">Waste type breakdown (all wards)</span></div>
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

          <div className="card">
            <div className="card-header"><span className="eyebrow">Ward detail</span></div>
            <TableScroll>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ward</th>
                    <th>Checks</th>
                    <th>Compliance</th>
                    <th>Weight (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((s) => (
                    <tr key={s.ward_number}>
                      <td>Ward {s.ward_number}</td>
                      <td>{s.total}</td>
                      <td>{s.compliance_rate !== null ? `${s.compliance_rate}%` : "—"}</td>
                      <td>{Number(s.total_weight_kg || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          </div>
        </div>
      )}

      {myRoutes.length > 0 && (
        <div className="card mt">
          <div className="card-header"><span className="eyebrow">My assigned routes today</span></div>
          <Alert kind="error">{broadcastError}</Alert>
          {myRoutes.map((r) => (
            <div key={r.id} className="route-item">
              <div className="route-item-head">
                <p className="list-item-title">Ward {r.ward_number}</p>
                <StatusPill status={r.status} />
              </div>
              {ACTIVE_STATUSES.includes(r.status) && (
                <div className="actions actions-stack mt-sm">
                  <button
                    className={broadcastingIds[r.id] ? "btn btn-accent" : "btn btn-primary"}
                    onClick={() => (broadcastingIds[r.id] ? stopBroadcasting(r.id) : startBroadcasting(r.id))}
                  >
                    {broadcastingIds[r.id] ? "Stop broadcasting location" : "Start broadcasting location"}
                  </button>
                </div>
              )}
              {r.current_lat && r.current_lng && (
                <div className="route-map">
                  <LiveTruckMap lat={r.current_lat} lng={r.current_lng} label={`Ward ${r.ward_number}`} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="card mt">
        <div className="card-header"><span className="eyebrow">Assign today's route</span></div>
        <form onSubmit={handleAssignRoute} className="assign-form">
          <Field label="Ward number">
            <input
              value={wardInput}
              onChange={(e) => setWardInput(e.target.value)}
              placeholder="1 to 29"
              type="number"
              min="1"
              max="29"
            />
          </Field>
          <Field label="Collector">
            <select value={collectorInput} onChange={(e) => setCollectorInput(e.target.value)}>
              <option value="">Select collector</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>{s.username}</option>
              ))}
            </select>
          </Field>
          <button type="submit" className="btn btn-primary">Assign</button>
        </form>
        <Alert kind="error">{routeError}</Alert>
      </div>

      <div className="card mt">
        <div className="card-header"><span className="eyebrow">Today's routes</span></div>
        {routes.length === 0 && (
          <EmptyState title="No routes assigned today">Assign a collector to a ward above.</EmptyState>
        )}
        {routes.map((r) => (
          <div key={r.id} className="route-item">
            <div className="route-item-head">
              <div className="list-item-main">
                <p className="list-item-title">Ward {r.ward_number} · {r.collector_username}</p>
                <p className="list-item-meta">
                  {r.last_location_update
                    ? `Last update ${new Date(r.last_location_update).toLocaleTimeString()}`
                    : "No location yet"}
                </p>
              </div>
              <StatusPill status={r.status} />
            </div>
            {ACTIVE_STATUSES.includes(r.status) && (
              <div className="actions actions-stack mt-sm">
                {r.status === "assigned" && (
                  <button className="btn btn-outline btn-sm" onClick={() => handleStatusChange(r.id, "in_progress")}>Start</button>
                )}
                {r.status === "in_progress" && (
                  <button className="btn btn-primary btn-sm" onClick={() => handleStatusChange(r.id, "completed")}>Complete</button>
                )}
                <button className="btn btn-accent btn-sm" onClick={() => handleStatusChange(r.id, "missed")}>Mark missed</button>
              </div>
            )}
            {r.current_lat && r.current_lng && (
              <div className="route-map">
                <LiveTruckMap lat={r.current_lat} lng={r.current_lng} label={`${r.collector_username} · Ward ${r.ward_number}`} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default WardDashboard;