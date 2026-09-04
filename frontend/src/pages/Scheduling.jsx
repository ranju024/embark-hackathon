import { useEffect, useState } from "react";
import { getWardSchedules, getEffectiveSchedule } from "../api/scheduling";

function Scheduling() {
  const [schedules, setSchedules] = useState([]);
  const [ward, setWard] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getWardSchedules().then(setSchedules);
  }, []);

  const handleCheck = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);
    try {
      const data = await getEffectiveSchedule(ward, date);
      setResult(data);
    } catch (err) {
      setError("Could not fetch schedule — check the ward number exists.");
    }
  };

  return (
    <div>
      <h2>Collection Scheduling</h2>

      <h3>All Ward Schedules</h3>
      <ul>
        {schedules.map((s) => (
          <li key={s.id}>
            Ward {s.ward_number} — {s.pickup_day_display} at {s.pickup_time}
          </li>
        ))}
      </ul>

      <h3>Check a Specific Date</h3>
      <form onSubmit={handleCheck}>
        <input
          value={ward}
          onChange={(e) => setWard(e.target.value)}
          placeholder="Ward number"
          type="number"
        />
        <input
          value={date}
          onChange={(e) => setDate(e.target.value)}
          type="date"
        />
        <button type="submit">Check</button>
      </form>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {result && (
        <div style={{ border: "1px solid #ccc", padding: 12, marginTop: 12 }}>
          {result.status === "normal" && <p>Normal pickup at {result.time}</p>}
          {result.status === "delayed" && (
            <p>Delayed to {result.time} — {result.reason}</p>
          )}
          {result.status === "no_pickup" && <p>No pickup today — {result.reason}</p>}
        </div>
      )}
    </div>
  );
}

export default Scheduling;