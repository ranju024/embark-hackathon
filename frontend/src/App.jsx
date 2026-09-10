import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from "react-router-dom";
import { getMe } from "./api";
import Home from "./pages/Home";
import { isLoggedIn, logout } from "./auth";
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


function AppContent() {
  const [loggedIn, setLoggedIn] = useState(isLoggedIn());
  const [isStaff, setIsStaff] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (loggedIn) {
      getMe().then((data) => setIsStaff(data.is_staff));
    } else {
      setIsStaff(false);
    }
  }, [loggedIn]);

  const handleLogout = () => {
    logout();
    setLoggedIn(false);
    setMenuOpen(false);
    navigate("/");
  };

  return (
    <>
      <nav className="navbar">
        <div className="navbar-brand">
          <span className="navbar-logo">W</span>
          Waste Warrior
        </div>

        <button
          className="navbar-toggle"
          onClick={() => setMenuOpen((prev) => !prev)}
        >
          ☰
        </button>

        <div className={`navbar-links ${menuOpen ? "open" : ""}`}>
          <NavLink to="/" end onClick={() => setMenuOpen(false)}>Home</NavLink>
          <NavLink to="/households" onClick={() => setMenuOpen(false)}>Households</NavLink>
          <NavLink to="/scheduling" onClick={() => setMenuOpen(false)}>Scheduling</NavLink>
          <NavLink to="/compliance" onClick={() => setMenuOpen(false)}>Compliance</NavLink>
          <NavLink to="/subscriptions" onClick={() => setMenuOpen(false)}>Subscriptions</NavLink>
          <NavLink to="/rewards" onClick={() => setMenuOpen(false)}>Rewards</NavLink>
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
        <Route path="/households" element={<Households isStaff={isStaff} />} />
        <Route path="/scheduling" element={<Scheduling isStaff={isStaff} />} />
        <Route path="/compliance" element={<Compliance isStaff={isStaff} />} />
        <Route path="/subscriptions" element={<SubscriptionPlans />} />
        <Route path="/subscription/payment-success" element={<PaymentResult outcome="success" />} />
        <Route path="/subscription/payment-failure" element={<PaymentResult outcome="failure" />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/login" element={<Login onLogin={() => setLoggedIn(true)} />} />
        <Route path="/register" element={<Register onLogin={() => setLoggedIn(true)} />} />
        <Route path="/rewards" element={<RewardsHub />} />
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