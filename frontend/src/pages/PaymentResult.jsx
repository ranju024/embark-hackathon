import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { verifyEsewaPayment } from "../api/subscriptions";
import { Spinner, EmptyState } from "../components/ui";
import { formatApiError } from "../lib/errors";

function PaymentResult({ outcome }) {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("verifying"); // verifying | success | failed
  const [message, setMessage] = useState("");

  useEffect(() => {
    const data = searchParams.get("data");

    if (!data) {
      setStatus("failed");
      setMessage(
        outcome === "failure"
          ? "Payment was cancelled or did not complete."
          : "No payment data received from eSewa."
      );
      return;
    }

    verifyEsewaPayment(data)
      .then(() => {
        setStatus("success");
        setMessage("Your subscription is now active.");
      })
      .catch((err) => {
        setStatus("failed");
        setMessage(formatApiError(err, "Payment verification failed."));
      });
  }, [searchParams, outcome]);

  return (
    <div className="page-container">
      <div className="card narrow">
        {status === "verifying" && <Spinner label="Verifying your payment with eSewa..." />}

        {status === "success" && (
          <EmptyState
            icon="check"
            title="Payment successful"
            action={
              <div className="actions" style={{ justifyContent: "center", marginTop: 16 }}>
                <Link to="/services" className="btn btn-primary">View my perks</Link>
                <Link to="/subscriptions" className="btn btn-outline">Back to plans</Link>
              </div>
            }
          >
            {message}
          </EmptyState>
        )}

        {status === "failed" && (
          <EmptyState
            icon="alert"
            title="Payment not completed"
            action={
              <div className="actions" style={{ justifyContent: "center", marginTop: 16 }}>
                <Link to="/subscriptions" className="btn btn-primary">Back to plans</Link>
              </div>
            }
          >
            {message}
          </EmptyState>
        )}
      </div>
    </div>
  );
}

export default PaymentResult;