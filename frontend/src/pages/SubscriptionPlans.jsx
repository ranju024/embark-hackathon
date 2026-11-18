import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSubscriptionPlans, getMySubscription, subscribeToPlan, redirectToEsewa } from "../api/subscriptions";
import { isLoggedIn } from "../auth";
import { PageHeader, Alert, Spinner } from "../components/ui";
import { formatApiError } from "../lib/errors";

const FEATURE_LABELS = [
  ["assisted_segregation", "Collectors segregate your waste for you"],
  ["priority_pickup", "Priority pickup slot"],
  ["compost_addon", "Compost pickup add-on"],
  ["bulk_pickup_credits_per_month", "Bulk/special pickup credits"],
  ["monthly_compliance_report", "Monthly compliance report"],
];

function PlanFeatureList({ plan }) {
  return (
    <ul className="tick-list">
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
  const navigate = useNavigate();
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
        setError("Could not load subscription plans. Please refresh.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSubscribe = async (planId) => {
    if (!isLoggedIn()) {
      navigate("/login");
      return;
    }
    setError("");
    setSubscribingId(planId);
    try {
      const { esewa_form_url, form_fields } = await subscribeToPlan(planId);
      redirectToEsewa(esewa_form_url, form_fields);
      // browser navigates away here, no further state update needed
    } catch (err) {
      setError(formatApiError(err, "Could not start subscription."));
      setSubscribingId(null);
    }
  };

  if (loading) {
    return <div className="page-container"><Spinner label="Loading plans..." /></div>;
  }

  const active = mySubscription?.status === "active" ? mySubscription : null;
  const locked = active && !active.can_renew; // active plan with plenty of time left

  const buttonLabel = (plan) => {
    if (subscribingId === plan.id) return "Redirecting to eSewa...";
    if (active && active.plan.id === plan.id) return locked ? "Current plan" : "Renew with eSewa";
    if (locked) return "Available near the end of your period";
    return "Subscribe with eSewa";
  };

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Subscriptions"
        title="Go beyond free collection"
        subtitle="Basic waste collection from LMC is always free. These plans add extra convenience on top."
      />

      {active && (
        <div className="card mb">
          <div className="card-header">
            <span className="eyebrow">Your plan</span>
            <span className="pill pill-success">Active</span>
          </div>
          <p className="list-item-title">{active.plan.name}</p>
          <p className="list-item-meta">
            Until {new Date(active.period_end).toLocaleDateString()} · {active.days_remaining} day
            {active.days_remaining === 1 ? "" : "s"} left
          </p>
          {active.can_renew && (
            <Alert kind="warning">
              Your plan ends soon. Renew now and the new period starts when this one ends.
            </Alert>
          )}
        </div>
      )}

      {mySubscription?.status === "expired" && (
        <Alert kind="warning">
          Your {mySubscription.plan.name} plan has expired. Pick a plan below to continue.
        </Alert>
      )}

      {mySubscription?.status === "payment_failed" && (
        <Alert kind="warning">
          Your last payment attempt failed. Pick a plan below to try again.
        </Alert>
      )}

      <Alert kind="error">{error}</Alert>

      <div className="grid-auto">
        {plans.map((plan) => {
          const isCurrent = active && active.plan.id === plan.id;
          return (
            <div key={plan.id} className={`card plan-card${isCurrent ? " current" : ""}`}>
              <span className="eyebrow">{plan.name}</span>
              <p className="plan-price">
                Rs. {plan.monthly_price_npr}<small> / month</small>
              </p>
              <p className="muted">{plan.description}</p>
              <PlanFeatureList plan={plan} />
              <button
                className="btn btn-primary"
                disabled={subscribingId === plan.id || locked}
                onClick={() => handleSubscribe(plan.id)}
              >
                {buttonLabel(plan)}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default SubscriptionPlans;