import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register, login } from "../api";
import { Alert, Field } from "../components/ui";
import { formatApiError } from "../lib/errors";

function Register({ onLogin }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await register(username.trim(), email.trim(), password);
      await login(username.trim(), password);
      onLogin();
      navigate("/onboarding");
    } catch (err) {
      setError(formatApiError(err, "Registration failed. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <span className="eyebrow">JOIN WASTE WARRIOR</span>
        <h2>Create account</h2>
        <form onSubmit={handleSubmit}>
          <Field label="Username">
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
          </Field>
          <Field label="Email">
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" required />
          </Field>
          <Field label="Password" hint="At least 6 characters.">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="new-password"
              minLength={6}
              required
            />
          </Field>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Creating account..." : "Create account"}
          </button>
        </form>
        <Alert kind="error">{error}</Alert>
        <p className="auth-links">Already have an account? <Link to="/login">Log in</Link></p>
      </div>
    </div>
  );
}

export default Register;