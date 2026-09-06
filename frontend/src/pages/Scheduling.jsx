import { useEffect, useState } from "react";
import {
  getWardSchedules,
  getEffectiveSchedule,
  createWardSchedule,
  updateWardSchedule,
  createScheduleNotice,
} from "../api/scheduling";

const DAYS = [
  { value: 0, label: "Monday" },
  { value: 1, label: "Tuesday" },
  { value: 2, label: "Wednesday" },
  { value: 3, label: "Thursday" },
  { value: 4, label: "Friday" },
  { value: 5, label: "Saturday" },
  { value: 6, label: "Sunday" },
];

function Scheduling({ isStaff }) {
  const [schedules, setSchedules] = useState([]);
  const [ward, setWard] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  // --- Staff-only: create a ward schedule ---
  const [newWard, setNewWard] = useState("");
  const [newDay, setNewDay] = useState(0);
  const [newTime, setNewTime] = useState("");
  const [scheduleMsg, setScheduleMsg] = useState("");

  // --- Staff-only: create a notice ---
  const [noticeWard, setNoticeWard] = useState("");
  const [noticeDate, setNoticeDate] = useState("");
  const [noticeType, setNoticeType] = useState("holiday");
  const [noticeDelay, setNoticeDelay] = useState("");
  const [noticeReason, setNoticeReason] = useState("");
  const [noticeMsg, setNoticeMsg] = useState("");

  const loadSchedules = () => getWardSchedules().then(setSchedules);

  useEffect(() => {
    loadSchedules();
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

  const handleCreateSchedule = async (e) => {
    e.preventDefault();
    setScheduleMsg("");
    try {
    // Does a schedule for this ward already exist in what we've loaded?
    const existing = schedules.find(
      (s) => s.ward_number === parseInt(newWard)
    );
 
    if (existing) {
      await updateWardSchedule(existing.id, newDay, newTime);
      setScheduleMsg("Schedule updated.");
    } else {
      await createWardSchedule(newWard, newDay, newTime);
      setScheduleMsg("Schedule created.");
    }
      setNewWard("");
      setNewTime("");
      loadSchedules();
    } catch (err) {
      setScheduleMsg(err.response?.data ? JSON.stringify(err.response.data) : "Failed to create.");
    }
  };

  const handleCreateNotice = async (e) => {
    e.preventDefault();
    setNoticeMsg("");
    try {
      await createScheduleNotice(noticeWard, noticeDate, noticeType, noticeDelay, noticeReason);
      setNoticeMsg("Notice created.");
      setNoticeWard("");
      setNoticeDate("");
      setNoticeDelay("");
      setNoticeReason("");
    } catch (err) {
      setNoticeMsg(err.response?.data ? JSON.stringify(err.response.data) : "Failed to create.");
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
        <input value={ward} onChange={(e) => setWard(e.target.value)} placeholder="Ward number" type="number" />
        <input value={date} onChange={(e) => setDate(e.target.value)} type="date" />
        <button type="submit">Check</button>
      </form>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {result && (
        <div style={{ border: "1px solid #ccc", padding: 12, marginTop: 12 }}>
          {result.status === "normal" && <p>Normal pickup at {result.time}</p>}
          {result.status === "delayed" && <p>Delayed to {result.time} — {result.reason}</p>}
          {result.status === "no_pickup" && <p>No pickup today — {result.reason}</p>}
        </div>
      )}

      {isStaff && (
        <>
          <hr style={{ margin: "24px 0" }} />
          <h3>Create Ward Schedule (Staff)</h3>
          <form onSubmit={handleCreateSchedule}>
            <input value={newWard} onChange={(e) => setNewWard(e.target.value)} placeholder="Ward number" type="number" />
            <select value={newDay} onChange={(e) => setNewDay(e.target.value)}>
              {DAYS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
            <input value={newTime} onChange={(e) => setNewTime(e.target.value)} type="time" />
            <button type="submit">Create Schedule</button>
          </form>
          {scheduleMsg && <p>{scheduleMsg}</p>}

          <h3>Create Notice (Staff)</h3>
          <form onSubmit={handleCreateNotice}>
            <input
              value={noticeWard}
              onChange={(e) => setNoticeWard(e.target.value)}
              placeholder="Ward number (blank = citywide)"
            />
            <input value={noticeDate} onChange={(e) => setNoticeDate(e.target.value)} type="date" />
            <select value={noticeType} onChange={(e) => setNoticeType(e.target.value)}>
              <option value="holiday">Holiday</option>
              <option value="delay">Delay</option>
            </select>
            {noticeType === "delay" && (
              <input value={noticeDelay} onChange={(e) => setNoticeDelay(e.target.value)} type="time" />
            )}
            <input
              value={noticeReason}
              onChange={(e) => setNoticeReason(e.target.value)}
              placeholder="Reason"
            />
            <button type="submit">Create Notice</button>
          </form>
          {noticeMsg && <p>{noticeMsg}</p>}
        </>
      )}
    </div>
  );
}

export default Scheduling;