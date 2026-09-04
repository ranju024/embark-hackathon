import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import api from "./api";
import Households from "./pages/Households";
import Login from "./pages/Login";

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
        <Link to="/households">Households</Link>
        <Link to="/login">Login</Link>
      </nav>

      <div style={{ fontFamily: "sans-serif", maxWidth: 600, margin: "40px auto" }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/households" element={<Households />} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;