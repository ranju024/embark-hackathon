import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getPublicStats } from "../api/stats";

function StatCard({ value, label }) {
  return (
    <div className="stat-pill" style={{ minWidth: 140 }}>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

function Home() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPublicStats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page-container">
      <div className="header-banner">
        <span className="eyebrow">LIVE IN LALITPUR METROPOLITAN CITY</span>
        <h1>Waste Warriors</h1>
        <p style={{ maxWidth: 560, opacity: 0.85 }}>
          Verified waste segregation for households and restaurants — QR-tracked pickups,
          real compliance data, and a rewards system that makes doing it right worth it.
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <Link to="/register" className="btn btn-primary">Register Your Household</Link>
          <Link to="/subscriptions" className="btn btn-outline">See Plans</Link>
        </div>
      </div>

      <div className="card">
        <span className="eyebrow">OUR IMPACT SO FAR</span>
        {loading && <p>Loading live stats...</p>}
        {!loading && !stats && <p>Stats are temporarily unavailable.</p>}
        {!loading && stats && (
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 12 }}>
            <StatCard value={stats.total_households} label="Households registered" />
            <StatCard value={stats.active_wards} label="Wards active" />
            <StatCard value={`${stats.total_weight_kg} kg`} label="Waste tracked" />
            <StatCard
              value={stats.compliance_rate !== null ? `${stats.compliance_rate}%` : "—"}
              label="Compliance rate"
            />
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <span className="eyebrow">HOW IT WORKS</span>
        <ol style={{ paddingLeft: 20, marginTop: 12 }}>
          <li>Register your household and get your unique QR code</li>
          <li>Segregate waste into LMC's color-coded bags — organic vs dry</li>
          <li>Collectors scan your QR and log the pickup on their rounds</li>
          <li>Earn GreenPoints for compliance, climb badge tiers, unlock rewards</li>
        </ol>
      </div>
    </div>
  );
}

export default Home;