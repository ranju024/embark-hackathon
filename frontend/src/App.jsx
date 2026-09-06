import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Link, useNavigate } from "react-router-dom";
import api from "./api";
import { isLoggedIn, logout } from "./auth";
import Households from "./pages/Households";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Scheduling from "./pages/Scheduling";
import Compliance from "./pages/Compliance";
import Chat from "./pages/Chat";

function Home() {
  const [status, setStatus] = useState("checking...");

  useEffect(() => {
    api
      .get("/health/")
      .then((res) => setStatus(res.data.message))
      .catch(() => setStatus("cannot reach backend — check it's running on :8000"));
  }, []);

  return (
    <div>
      <h1>Waste Warriors</h1>
      <p>Backend status: <strong>{status}</strong></p>
    </div>
  );
}

function AppContent() {
  const [loggedIn, setLoggedIn] = useState(isLoggedIn());
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    setLoggedIn(false);
    navigate("/");
  };

  return (
    <>
      <nav style={{ marginBottom: 24 }}>
        <Link to="/" style={{ marginRight: 12 }}>Home</Link>
        <Link to="/households" style={{ marginRight: 12 }}>Households</Link>
        <Link to="/scheduling" style={{ marginRight: 12 }}>Scheduling</Link>
        <Link to="/compliance" style={{ marginRight: 12 }}>Compliance</Link>
        <Link to="/chat" style={{ marginRight: 12 }}>Chat</Link>
        {loggedIn ? (
          <button onClick={handleLogout}>Log Out</button>
        ) : (
          <>
            <Link to="/login" style={{ marginRight: 12 }}>Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </nav>

      <div style={{ fontFamily: "sans-serif", maxWidth: 600, margin: "40px auto" }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/households" element={<Households />} />
          <Route path="/scheduling" element={<Scheduling />} />
          <Route path="/compliance" element={<Compliance />} />
          <Route path="/chat" element={<Chat />} />
          <Route
            path="/login"
            element={<Login onLogin={() => setLoggedIn(true)} />}
          />
          <Route path="/register" element={<Register onLogin={() => setLoggedIn(true)} />} />
        </Routes>
      </div>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;