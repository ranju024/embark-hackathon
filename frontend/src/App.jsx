import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import api from "./api";
import Households from "./pages/Households";
import Login from "./pages/Login";
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

function App() {
  return (
    <BrowserRouter>
      <nav style={{ marginBottom: 24 }}>
        <Link to="/" style={{ marginRight: 12 }}>Home</Link>
        <Link to="/households" style={{ marginRight: 12 }}>Households</Link>
        <Link to="/schdeduling" style={{ marginRight: 12}}>Scheduling</Link>
        <Link to="/compliance" style={{ marginRight: 12}}>Compliance</Link>
        <Link to="/chat" style={{ marginRight: 12 }}>Chat</Link>
        <Link to="/login">Login</Link>
      </nav>

      <div style={{ fontFamily: "sans-serif", maxWidth: 600, margin: "40px auto" }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/households" element={<Households />} />
          <Route path="/schdeduling" element={<Scheduling />} />
          <Route path="/compliance" element={<Compliance />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;