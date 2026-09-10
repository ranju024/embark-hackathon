import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { verifyEsewaPayment } from "../api/subscriptions";

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
        setMessage("Your subscription is now active!");
      })
      .catch((err) => {
        setStatus("failed");
        setMessage(err.response?.data?.detail || "Payment verification failed.");
      });
  }, [searchParams, outcome]);

  return (
    <div className="page-container">
      <div className="card" style={{ textAlign: "center", maxWidth: 420, margin: "40px auto" }}>
        {status === "verifying" && <p>Verifying your payment with eSewa...</p>}
        {status === "success" && (
          <>
            <h2 style={{ color: "var(--color-primary, #1B4332)" }}>Payment Successful</h2>
            <p>{message}</p>
          </>
        )}
        {status === "failed" && (
          <>
            <h2 style={{ color: "var(--color-accent, #C1652F)" }}>Payment Not Completed</h2>
            <p>{message}</p>
          </>
        )}
        <Link to="/subscriptions" className="btn btn-primary" style={{ marginTop: 16, display: "inline-block" }}>
          Back to Plans
        </Link>
      </div>
    </div>
  );
}

export default PaymentResult;