import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMonthlyReport } from "../api/premium";
import { PageHeader, Alert, Spinner, EmptyState, Stat, StatusPill, TableScroll } from "../components/ui";
import { formatApiError } from "../lib/errors";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function Row({ label, value }) {
  return (
    <div className="list-item">
      <span>{label}</span>
      <strong>{value}</strong>
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
        else setError(formatApiError(err, "Could not load the report."));
      })
      .finally(() => setLoading(false));
  }, [month]);

  if (locked) {
    return (
      <div className="page-container">
        <PageHeader title="Monthly compliance report" />
        <div className="card">
          <EmptyState
            title="Reports aren't in your plan"
            action={<Link to="/subscriptions" className="btn btn-primary mt-sm">See plans</Link>}
          >
            Upgrade to get a printable summary of your month.
          </EmptyState>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <PageHeader eyebrow="Monthly report" title="Compliance report" />

      <div className="scan-row no-print mb">
        <input
          type="month"
          value={month}
          max={currentMonth()}
          aria-label="Report month"
          onChange={(e) => e.target.value && setMonth(e.target.value)}
        />
        <button className="btn btn-outline" onClick={() => window.print()} disabled={!report}>
          Print / Save as PDF
        </button>
      </div>

      <Alert kind="error">{error}</Alert>
      {loading && <Spinner label="Loading report..." />}

      {report && !loading && (
        <div className="stack-lg">
          <div className="card">
            <p className="list-item-title">{report.month_label}</p>
            <p style={{ margin: 0 }}>
              {report.household.owner_name} · H.No {report.household.house_number} · Ward {report.household.ward_number}
            </p>
            <p className="list-item-meta">
              Plan: {report.plan || "—"} · Generated {report.generated_on}
            </p>
          </div>

          <div className="stat-grid">
            <Stat value={report.summary.total_checks} label="Waste checks" />
            <Stat
              value={report.summary.compliance_rate !== null ? `${report.summary.compliance_rate}%` : "—"}
              label="Compliance rate"
            />
            <Stat value={`${report.summary.total_kg.toFixed(2)} kg`} label="Waste collected" />
            <Stat value={report.points.net} label="Net GreenPoints" />
          </div>

          <div className="card">
            <div className="card-header"><span className="eyebrow">Breakdown</span></div>
            <Row label="Compliant" value={report.summary.compliant} />
            <Row label="Non-compliant" value={report.summary.non_compliant} />
            <Row label="Awaiting review" value={report.summary.pending_review} />
            <Row label="Organic" value={`${report.summary.organic_kg.toFixed(2)} kg`} />
            <Row label="Dry" value={`${report.summary.dry_kg.toFixed(2)} kg`} />
            <Row label="Mixed" value={`${report.summary.both_kg.toFixed(2)} kg`} />
            <Row label="Points earned" value={`+${report.points.earned}`} />
            <Row label="Points lost" value={`-${report.points.lost}`} />
            <Row label="Spent on rewards" value={`-${report.points.redeemed}`} />
            <Row label="Bulk pickups completed" value={report.summary.bulk_pickups_completed} />
            <p className="note">Points count in the month an officer reviewed the check.</p>
          </div>

          <div className="card">
            <div className="card-header"><span className="eyebrow">Checks this month</span></div>
            {report.checks.length === 0 ? (
              <EmptyState title="No checks this month">No waste checks were recorded for this month.</EmptyState>
            ) : (
              <TableScroll>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Weight</th>
                      <th>Result</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.checks.map((c, i) => (
                      <tr key={i}>
                        <td>{new Date(c.date).toLocaleDateString()}</td>
                        <td className="cap">{c.waste_type}</td>
                        <td>{c.weight_kg.toFixed(2)} kg</td>
                        <td><StatusPill status={c.status} /></td>
                        <td>{c.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default MonthlyReport;