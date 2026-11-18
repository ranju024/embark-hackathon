import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createHousehold, getMyHousehold } from "../api/households";
import { getSubscriptionPlans, subscribeToPlan, redirectToEsewa } from "../api/subscriptions";
import { isLoggedIn } from "../auth";
import { PageHeader, Alert, Spinner, Field } from "../components/ui";
import { formatApiError } from "../lib/errors";

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

  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState("");
  const [submitting, setSubmitting] = useState(false);
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
    if (!ownerName.trim() || !phoneNumber.trim()) {
      setError("Name and phone number are both required.");
      return;
    }
    setSubmitting(true);
    try {
      await createHousehold(wardNumber, houseNumber, ownerName.trim(), phoneNumber.trim());
    } catch (err) {
      setError(formatApiError(err, "Could not register household."));
      setSubmitting(false);
      return;
    }

    // Household exists now. Plans failing to load must not trap the wizard.
    setStep(3);
    setSubmitting(false);
    setPlansLoading(true);
    try {
      setPlans(await getSubscriptionPlans());
    } catch {
      setPlansError("Couldn't load paid plans right now. You can pick one later from the Plans page.");
    } finally {
      setPlansLoading(false);
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
      setError(formatApiError(err, "Could not start subscription."));
      setSubscribingId(null);
    }
  };

  if (checkingExisting) {
    return <div className="page-container"><Spinner /></div>;
  }

  return (
    <div className="page-container">
      <PageHeader eyebrow="Household registration" title="Join Waste Warrior" />
      <StepIndicator currentStep={step} />

      {step === 1 && (
        <div className="card">
          <h3>Where's your household?</h3>
          <form onSubmit={handleLocationNext} className="stack">
            <Field label="Ward number" hint="Lalitpur Metropolitan City has wards 1 to 29.">
              <input
                value={wardNumber}
                onChange={(e) => setWardNumber(e.target.value)}
                placeholder="e.g. 5"
                type="number"
                min="1"
                max="29"
              />
            </Field>
            <Field label="House number">
              <input
                value={houseNumber}
                onChange={(e) => setHouseNumber(e.target.value)}
                placeholder="e.g. 112"
              />
            </Field>
            <Alert kind="error">{error}</Alert>
            <div className="actions actions-stack">
              <button type="submit" className="btn btn-primary">Next</button>
            </div>
          </form>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <h3>Who should we contact?</h3>
          <form onSubmit={handleContactNext} className="stack">
            <Field label="Full name">
              <input
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
              />
            </Field>
            <Field label="Phone number">
              <input
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="98XXXXXXXX"
                type="tel"
                autoComplete="tel"
              />
            </Field>
            <Alert kind="error">{error}</Alert>
            <div className="actions actions-stack">
              <button type="button" className="btn btn-outline" onClick={() => setStep(1)} disabled={submitting}>
                Back
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? "Registering..." : "Next"}
              </button>
            </div>
          </form>
        </div>
      )}

      {step === 3 && (
        <div className="stack-lg">
          <div>
            <h3>Pick a plan</h3>
            <p className="muted" style={{ margin: 0 }}>
              Your household is registered. Basic collection from LMC is always free, and these plans add extra convenience.
            </p>
          </div>

          <Alert kind="error">{error}</Alert>
          <Alert kind="warning">{plansError}</Alert>

          <div className="grid-auto">
            <div className="card plan-card">
              <span className="eyebrow">Free</span>
              <p className="plan-price">Rs. 0<small> / month</small></p>
              <p className="muted">
                Standard scheduled pickup. No cost, and no signup needed beyond your household.
              </p>
              <button className="btn btn-outline" onClick={handleContinueFree}>
                Continue with free plan
              </button>
            </div>

            {plansLoading && (
              <div className="card"><Spinner label="Loading plans..." /></div>
            )}

            {!plansLoading && plans.map((plan) => (
              <div key={plan.id} className="card plan-card">
                <span className="eyebrow">{plan.name}</span>
                <p className="plan-price">
                  Rs. {plan.monthly_price_npr}<small> / month</small>
                </p>
                <p className="muted">{plan.description}</p>
                <button
                  className="btn btn-primary"
                  disabled={subscribingId === plan.id}
                  onClick={() => handleSubscribe(plan.id)}
                >
                  {subscribingId === plan.id ? "Redirecting to eSewa..." : `Subscribe to ${plan.name}`}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Onboarding;