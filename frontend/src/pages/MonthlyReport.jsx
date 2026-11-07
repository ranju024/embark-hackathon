import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMonthlyReport } from "../api/premium";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function Stat({ value, label }) {
  return (
    <div className="card" style={{ flex: "1 1 140px", textAlign: "center" }}>
      <p style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700 }}>{value}</p>
      <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-muted)" }}>{label}</p>
    </div>
  );
}

function MonthlyReport() {
  const [month, setMonth] = useState(currentMonth());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError("");
    getMonthlyReport(month)
      .then((data) => { setReport(data); setLocked(false); })
      .catch((err) => {
        setReport(null);
        if (err.response?.status === 403) setLocked(true);
        else setError(err.response?.data?.detail || "Could not load the report.");
      })
      .finally(() => setLoading(false));
  }, [month]);

  if (locked) {
    return (
      <div className="page-container">
        <h2>Monthly compliance report</h2>
        <p>Reports aren't included in your current plan.</p>
        <Link to="/subscriptions" className="btn btn-primary">See plans →</Link>
      </div>
    );
  }

  return (
    <div className="page-container">
      <span className="eyebrow">MONTHLY REPORT</span>
      <h2>Compliance report</h2>

      <div className="no-print" style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input type="month" value={month} max={currentMonth()} onChange={(e) => e.target.value && setMonth(e.target.value)} />
        <button className="btn btn-outline" onClick={() => window.print()} disabled={!report}>Print / Save as PDF</button>
      </div>

      {loading && <p>Loading report...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {report && !loading && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <p style={{ margin: 0, fontWeight: 600 }}>{report.month_label}</p>
            <p style={{ margin: 0 }}>
              {report.household.owner_name} · H.No {report.household.house_number} · Ward {report.household.ward_number}
            </p>
            <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-muted)" }}>
              Plan: {report.plan || "—"} · Generated {report.generated_on}
            </p>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <Stat value={report.summary.total_checks} label="Waste checks" />
            <Stat value={report.summary.compliance_rate !== null ? `${report.summary.compliance_rate}%` : "—"} label="Compliance rate" />
            <Stat value={`${report.summary.total_kg.toFixed(2)} kg`} label="Waste collected" />
            <Stat value={report.points.net} label="Net GreenPoints" />
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <span className="eyebrow">BREAKDOWN</span>
            <p style={{ margin: "8px 0 0" }}>
              Compliant: {report.summary.compliant} · Non-compliant: {report.summary.non_compliant} · Awaiting review: {report.summary.pending_review}
            </p>
            <p style={{ margin: "4px 0 0" }}>
              Organic: {report.summary.organic_kg.toFixed(2)} kg · Dry: {report.summary.dry_kg.toFixed(2)} kg · Mixed: {report.summary.both_kg.toFixed(2)} kg
            </p>
            <p style={{ margin: "4px 0 0" }}>
              Points earned: +{report.points.earned} · Points lost: -{report.points.lost} · Spent on rewards: -{report.points.redeemed}
            </p>
            <p style={{ margin: "4px 0 0" }}>Bulk pickups completed: {report.summary.bulk_pickups_completed}</p>
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--color-text-muted)" }}>
              Points count in the month an officer reviewed the check.
            </p>
          </div>

          <div className="card">
            <span className="eyebrow">CHECKS THIS MONTH</span>
            {report.checks.length === 0 && <p>No waste checks were recorded this month.</p>}
            {report.checks.length > 0 && (
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "2px solid var(--color-border)" }}>
                    <th style={{ padding: "8px 4px" }}>Date</th>
                    <th style={{ padding: "8px 4px" }}>Type</th>
                    <th style={{ padding: "8px 4px" }}>Weight</th>
                    <th style={{ padding: "8px 4px" }}>Result</th>
                    <th style={{ padding: "8px 4px" }}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {report.checks.map((c, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--color-border)" }}>
                      <td style={{ padding: "8px 4px" }}>{new Date(c.date).toLocaleDateString()}</td>
                      <td style={{ padding: "8px 4px" }}>{c.waste_type}</td>
                      <td style={{ padding: "8px 4px" }}>{c.weight_kg.toFixed(2)} kg</td>
                      <td style={{ padding: "8px 4px" }}>{c.status.replace("_", " ")}</td>
                      <td style={{ padding: "8px 4px" }}>{c.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default MonthlyReport;