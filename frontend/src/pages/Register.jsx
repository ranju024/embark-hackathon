import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { register, login } from "../api";

function Register({ onLogin }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await register(username, email, password);
      await login(username, password);
      onLogin();
      navigate("/households");
    } catch (err) {
      setError(err.response?.data ? JSON.stringify(err.response.data) : "Registration failed.");
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <span className="eyebrow">JOIN WASTE WARRIOR</span>
        <h2>Create Account</h2>
        <form onSubmit={handleSubmit}>
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password" />
          <button type="submit" className="btn btn-primary">Register</button>
        </form>
        {error && <p style={{ color: "red" }}>{error}</p>}
      </div>
    </div>
  );
}

export default Register;