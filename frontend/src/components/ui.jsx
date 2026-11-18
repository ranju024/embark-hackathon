import Icon from "./Icon";

export function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <header className="page-header">
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <div className="page-header-top">
        <h2 style={{ margin: 0 }}>{title}</h2>
        {actions && <div className="row">{actions}</div>}
      </div>
      {subtitle && <p>{subtitle}</p>}
    </header>
  );
}

const ALERT_ICONS = { info: "alert", success: "check", warning: "alert", error: "alert" };

export function Alert({ kind = "info", children }) {
  if (!children) return null;
  return (
    <div className={`alert alert-${kind}`} role={kind === "error" ? "alert" : "status"}>
      <Icon name={ALERT_ICONS[kind] || "alert"} size={18} />
      <div>{children}</div>
    </div>
  );
}

export function Spinner({ label = "Loading..." }) {
  return (
    <div className="loading-block" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ icon = "check", title, children, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><Icon name={icon} size={24} /></div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

const PILL_TONE = {
  // good outcomes
  compliant: "success", resolved: "success", completed: "success", complete: "success", active: "success",
  // needs attention
  open: "warning", non_compliant: "warning", payment_failed: "warning", missed: "warning", failed: "warning",
  // in progress or closed without drama
  under_review: "neutral", pending_review: "neutral", scheduled: "neutral", assigned: "neutral",
  in_progress: "neutral", cancelled: "neutral", rejected: "neutral", expired: "neutral", superseded: "neutral",
};

export function StatusPill({ status, children }) {
  const tone = PILL_TONE[status] || "neutral";
  return (
    <span className={`pill pill-${tone} pill-cap`}>
      {children ?? String(status).replace(/_/g, " ")}
    </span>
  );
}

// Wrapping <label> ties the caption to the control without needing ids.
export function Field({ label, hint, error, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

export function Stat({ value, label }) {
  return (
    <div className="stat-card">
      <div className="value">{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}

export function TableScroll({ children }) {
  return <div className="table-scroll">{children}</div>;
}