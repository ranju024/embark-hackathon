import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../api";
import { Alert, Field } from "../components/ui";
import { formatApiError } from "../lib/errors";

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      onLogin();
      navigate("/households");
    } catch (err) {
      setError(
        err.response?.status === 401
          ? "Login failed. Check your username and password."
          : formatApiError(err, "Login failed. Please try again.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <span className="eyebrow">WELCOME BACK</span>
        <h2>Log in</h2>
        <form onSubmit={handleSubmit}>
          <Field label="Username">
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
          </Field>
          <Field label="Password">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Logging in..." : "Log in"}
          </button>
        </form>
        <Alert kind="error">{error}</Alert>
        <p className="auth-links">New here? <Link to="/register">Create an account</Link></p>
      </div>
    </div>
  );
}

export default Login;