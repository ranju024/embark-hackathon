import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, NavLink, Navigate, useNavigate } from "react-router-dom";
import { getMe } from "./api";
import { isLoggedIn, logout } from "./auth";
import Home from "./pages/Home";
import Households from "./pages/Households";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Scheduling from "./pages/Scheduling";
import Compliance from "./pages/Compliance";
import Chat from "./pages/Chat";
import SubscriptionPlans from "./pages/SubscriptionPlans";
import PaymentResult from "./pages/PaymentResult";
import Onboarding from "./pages/Onboarding";
import RewardsHub from "./pages/RewardsHub";
import WardDashboard from "./pages/WardDashboard";

/**
 * requireLogin: redirect to /login if logged out (default true)
 * staffOnly:    show a "staff only" message to non-staff users
 * Waits for the /auth/me/ lookup to finish before rendering, so staff
 * never see a flash of the resident view.
 */
function RouteGuard({ loggedIn, isStaff, staffReady, requireLogin = true, staffOnly = false, children }) {
  if (requireLogin && !loggedIn) return <Navigate to="/login" replace />;
  if (loggedIn && !staffReady) {
    return <div className="page-container"><p>Loading...</p></div>;
  }
  if (staffOnly && !isStaff) {
    return (
      <div className="page-container">
        <h2>Staff only</h2>
        <p>You don't have access to this page.</p>
      </div>
    );
  }
  return children;
}

function AppContent() {
  const [loggedIn, setLoggedIn] = useState(isLoggedIn());
  const [isStaff, setIsStaff] = useState(false);
  const [staffReady, setStaffReady] = useState(!isLoggedIn());
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (loggedIn) {
      setStaffReady(false);
      getMe()
        .then((data) => setIsStaff(data.is_staff))
        .catch(() => setIsStaff(false))
        .finally(() => setStaffReady(true));
    } else {
      setIsStaff(false);
      setStaffReady(true);
    }
  }, [loggedIn]);

  // api.js fires this when a token refresh fails (session truly expired).
  useEffect(() => {
    const handleForcedLogout = () => {
      setLoggedIn(false);
      navigate("/login");
    };
    window.addEventListener("auth:logout", handleForcedLogout);
    return () => window.removeEventListener("auth:logout", handleForcedLogout);
  }, [navigate]);

  const handleLogout = () => {
    logout();
    setLoggedIn(false);
    setMenuOpen(false);
    navigate("/");
  };

  const guardProps = { loggedIn, isStaff, staffReady };

  return (
    <>
      <nav className="navbar">
        <div className="navbar-brand">
          <span className="navbar-logo">W</span>
          Waste Warrior
        </div>

        <button className="navbar-toggle" onClick={() => setMenuOpen((prev) => !prev)}>
          ☰
        </button>

        <div className={`navbar-links ${menuOpen ? "open" : ""}`}>
          <NavLink to="/" end onClick={() => setMenuOpen(false)}>Home</NavLink>
          <NavLink to="/households" onClick={() => setMenuOpen(false)}>Households</NavLink>
          <NavLink to="/scheduling" onClick={() => setMenuOpen(false)}>Scheduling</NavLink>
          <NavLink to="/compliance" onClick={() => setMenuOpen(false)}>Compliance</NavLink>
          <NavLink to="/subscriptions" onClick={() => setMenuOpen(false)}>Subscriptions</NavLink>
          {loggedIn && <NavLink to="/rewards" onClick={() => setMenuOpen(false)}>Rewards</NavLink>}
          {isStaff && <NavLink to="/ward-dashboard" onClick={() => setMenuOpen(false)}>Ward Dashboard</NavLink>}
          <NavLink to="/chat" onClick={() => setMenuOpen(false)}>Chat</NavLink>
          {loggedIn ? (
            <button className="btn btn-outline" onClick={handleLogout}>Log Out</button>
          ) : (
            <>
              <NavLink to="/login" onClick={() => setMenuOpen(false)}>Login</NavLink>
              <NavLink to="/register" onClick={() => setMenuOpen(false)}>Register</NavLink>
            </>
          )}
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/households" element={<RouteGuard {...guardProps}><Households isStaff={isStaff} /></RouteGuard>} />
        <Route path="/scheduling" element={<RouteGuard {...guardProps} requireLogin={false}><Scheduling isStaff={isStaff} /></RouteGuard>} />
        <Route path="/compliance" element={<RouteGuard {...guardProps}><Compliance isStaff={isStaff} /></RouteGuard>} />
        <Route path="/subscriptions" element={<SubscriptionPlans />} />
        <Route path="/subscription/payment-success" element={<RouteGuard {...guardProps}><PaymentResult outcome="success" /></RouteGuard>} />
        <Route path="/subscription/payment-failure" element={<RouteGuard {...guardProps}><PaymentResult outcome="failure" /></RouteGuard>} />
        <Route path="/onboarding" element={<RouteGuard {...guardProps}><Onboarding /></RouteGuard>} />
        <Route path="/rewards" element={<RouteGuard {...guardProps}><RewardsHub /></RouteGuard>} />
        <Route path="/ward-dashboard" element={<RouteGuard {...guardProps} staffOnly><WardDashboard /></RouteGuard>} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/login" element={<Login onLogin={() => setLoggedIn(true)} />} />
        <Route path="/register" element={<Register onLogin={() => setLoggedIn(true)} />} />
        <Route path="*" element={<div className="page-container"><h2>Page not found</h2></div>} />
      </Routes>
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