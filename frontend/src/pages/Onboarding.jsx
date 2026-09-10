import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createHousehold, getMyHousehold } from "../api/households";
import { getSubscriptionPlans, subscribeToPlan, redirectToEsewa } from "../api/subscriptions";
import { isLoggedIn } from "../auth";

const STEPS = ["Location", "Contact", "Plan"];

function StepIndicator({ currentStep }) {
  return (
    <div className="wizard-steps">
      {STEPS.map((label, i) => {
        const stepNumber = i + 1;
        const state = stepNumber === currentStep ? "active" : stepNumber < currentStep ? "done" : "";
        return (
          <div key={label} className={`wizard-step ${state}`}>
            <span className="wizard-step-dot">{stepNumber < currentStep ? "✓" : stepNumber}</span>
            <span className="wizard-step-label">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [checkingExisting, setCheckingExisting] = useState(true);

  const [wardNumber, setWardNumber] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  const [household, setHousehold] = useState(null);
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [subscribingId, setSubscribingId] = useState(null);
  const [error, setError] = useState("");

  // If they already have a household, this wizard isn't for them.
  useEffect(() => {
    if (!isLoggedIn()) {
      navigate("/login");
      return;
    }
    getMyHousehold()
      .then((existing) => {
        if (existing) {
          navigate("/households");
        } else {
          setCheckingExisting(false);
        }
      })
      .catch(() => setCheckingExisting(false));
  }, [navigate]);

  const handleLocationNext = (e) => {
    e.preventDefault();
    setError("");
    if (!wardNumber || !houseNumber) {
      setError("Ward number and house number are both required.");
      return;
    }
    setStep(2);
  };

  const handleContactNext = async (e) => {
    e.preventDefault();
    setError("");
    if (!ownerName || !phoneNumber) {
      setError("Name and phone number are both required.");
      return;
    }
    try {
      const created = await createHousehold(wardNumber, houseNumber, ownerName, phoneNumber);
      setHousehold(created);
      setPlansLoading(true);
      const plansData = await getSubscriptionPlans();
      setPlans(plansData);
      setPlansLoading(false);
      setStep(3);
    } catch (err) {
      setError(err.response?.data ? JSON.stringify(err.response.data) : "Could not register household.");
    }
  };

  const handleContinueFree = () => {
    navigate("/households");
  };

  const handleSubscribe = async (planId) => {
    setError("");
    setSubscribingId(planId);
    try {
      const { esewa_form_url, form_fields } = await subscribeToPlan(planId);
      redirectToEsewa(esewa_form_url, form_fields);
    } catch (err) {
      setError(err.response?.data?.detail || "Could not start subscription.");
      setSubscribingId(null);
    }
  };

  if (checkingExisting) {
    return <div className="page-container"><p>Loading...</p></div>;
  }

  return (
    <div className="page-container">
      <span className="eyebrow">HOUSEHOLD REGISTRATION</span>
      <h2>Join Waste Warrior</h2>
      <StepIndicator currentStep={step} />

      {step === 1 && (
        <div className="card">
          <h3>Where's your household?</h3>
          <form onSubmit={handleLocationNext} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
            <input
              value={wardNumber}
              onChange={(e) => setWardNumber(e.target.value)}
              placeholder="Ward number (1-29)"
              type="number"
              min="1"
              max="29"
            />
            <input
              value={houseNumber}
              onChange={(e) => setHouseNumber(e.target.value)}
              placeholder="House number"
            />
            <button type="submit" className="btn btn-primary">Next →</button>
          </form>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <h3>Who should we contact?</h3>
          <form onSubmit={handleContactNext} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
            <input
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="Full name"
            />
            <input
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Phone number"
            />
            <div style={{ display: "flex", gap: 12 }}>
              <button type="button" className="btn btn-outline" onClick={() => setStep(1)}>← Back</button>
              <button type="submit" className="btn btn-primary">Next →</button>
            </div>
          </form>
        </div>
      )}

      {step === 3 && (
        <div className="card">
          <h3>Pick a plan</h3>
          <p style={{ color: "var(--color-text-muted)" }}>
            Your household is registered! Basic collection from LMC is always free — these plans add extra convenience.
          </p>

          <div
            className="card"
            style={{ marginBottom: 12, border: "2px solid var(--color-border)" }}
          >
            <span className="eyebrow">FREE</span>
            <p style={{ fontWeight: 600, margin: "4px 0" }}>Basic Collection</p>
            <p style={{ color: "var(--color-text-muted)", margin: 0 }}>
              Standard scheduled pickup — no cost, no signup needed beyond your household.
            </p>
            <button className="btn btn-outline" style={{ marginTop: 12 }} onClick={handleContinueFree}>
              Continue with Free Plan →
            </button>
          </div>

          {plansLoading && <p>Loading plans...</p>}

          {!plansLoading && plans.map((plan) => (
            <div key={plan.id} className="card" style={{ marginBottom: 12 }}>
              <span className="eyebrow">{plan.name.toUpperCase()}</span>
              <p style={{ fontSize: "1.2rem", fontWeight: 700, margin: "4px 0" }}>
                Rs. {plan.monthly_price_npr}<span style={{ fontSize: "0.85rem", fontWeight: 400 }}>/month</span>
              </p>
              <p style={{ color: "var(--color-text-muted)" }}>{plan.description}</p>
              <button
                className="btn btn-primary"
                disabled={subscribingId === plan.id}
                onClick={() => handleSubscribe(plan.id)}
              >
                {subscribingId === plan.id ? "Redirecting to eSewa..." : `Subscribe to ${plan.name} →`}
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}

export default Onboarding;