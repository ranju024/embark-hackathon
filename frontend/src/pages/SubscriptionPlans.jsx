import { useEffect, useState } from "react";
import { getSubscriptionPlans, getMySubscription, subscribeToPlan, redirectToEsewa } from "../api/subscriptions";
import { isLoggedIn } from "../auth";

const FEATURE_LABELS = [
  ["assisted_segregation", "Collectors segregate your waste for you"],
  ["priority_pickup", "Priority pickup slot"],
  ["compost_addon", "Compost pickup add-on"],
  ["bulk_pickup_credits_per_month", "Bulk/special pickup credits"],
  ["monthly_compliance_report", "Monthly compliance report"],
];

function PlanFeatureList({ plan }) {
  return (
    <ul style={{ paddingLeft: 18, margin: "12px 0" }}>
      {FEATURE_LABELS.map(([key, label]) => {
        const value = plan[key];
        if (!value) return null;
        return (
          <li key={key}>
            {key === "bulk_pickup_credits_per_month" ? `${label} (${value}/mo)` : label}
          </li>
        );
      })}
    </ul>
  );
}

function SubscriptionPlans() {
  const [plans, setPlans] = useState([]);
  const [mySubscription, setMySubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subscribingId, setSubscribingId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const plansData = await getSubscriptionPlans();
        setPlans(plansData);
        if (isLoggedIn()) {
          const sub = await getMySubscription();
          setMySubscription(sub);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSubscribe = async (planId) => {
    setError("");
    setSubscribingId(planId);
    try {
      const { esewa_form_url, form_fields } = await subscribeToPlan(planId);
      redirectToEsewa(esewa_form_url, form_fields);
      // browser navigates away here — no further state update needed
    } catch (err) {
      setError(err.response?.data?.detail || "Could not start subscription.");
      setSubscribingId(null);
    }
  };

  if (loading) {
    return <div className="page-container"><p>Loading plans...</p></div>;
  }

  return (
    <div className="page-container">
      <span className="eyebrow">SUBSCRIPTIONS</span>
      <h2>Go beyond free collection</h2>
      <p style={{ color: "var(--color-text-muted)" }}>
        Basic waste collection from LMC is always free. These plans add extra convenience on top.
      </p>

      {mySubscription && mySubscription.status === "active" && (
        <div className="card" style={{ marginBottom: 16 }}>
          <span className="eyebrow">YOUR PLAN</span>
          <p style={{ margin: 0, fontWeight: 600 }}>{mySubscription.plan.name}</p>
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
            Active until {new Date(mySubscription.period_end).toLocaleDateString()}
          </p>
        </div>
      )}

      {mySubscription && mySubscription.status === "payment_failed" && (
        <p style={{ color: "var(--color-accent, #C1652F)" }}>
          Your last payment attempt failed. Pick a plan below to try again.
        </p>
      )}

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {plans.map((plan) => (
          <div key={plan.id} className="card" style={{ flex: "1 1 280px" }}>
            <span className="eyebrow">{plan.name.toUpperCase()}</span>
            <p style={{ fontSize: "1.4rem", fontWeight: 700, margin: "4px 0" }}>
              Rs. {plan.monthly_price_npr}<span style={{ fontSize: "0.9rem", fontWeight: 400 }}>/month</span>
            </p>
            <p style={{ color: "var(--color-text-muted)" }}>{plan.description}</p>
            <PlanFeatureList plan={plan} />
            <button
              className="btn btn-primary"
              disabled={subscribingId === plan.id}
              onClick={() => handleSubscribe(plan.id)}
            >
              {subscribingId === plan.id ? "Redirecting to eSewa..." : "Subscribe with eSewa"}
            </button>
          </div>
        ))}
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}

export default SubscriptionPlans;