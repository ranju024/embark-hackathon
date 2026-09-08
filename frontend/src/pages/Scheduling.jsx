import { useEffect, useState } from "react";
import {
  getWardSchedules,
  getEffectiveSchedule,
  createWardSchedule,
  updateWardSchedule,
  createScheduleNotice,
} from "../api/scheduling";

const DAYS = [
  { value: 0, label: "Monday" }, { value: 1, label: "Tuesday" },
  { value: 2, label: "Wednesday" }, { value: 3, label: "Thursday" },
  { value: 4, label: "Friday" }, { value: 5, label: "Saturday" },
  { value: 6, label: "Sunday" },
];

function Scheduling({ isStaff }) {
  const [schedules, setSchedules] = useState([]);
  const [ward, setWard] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const [newWard, setNewWard] = useState("");
  const [newDay, setNewDay] = useState(0);
  const [newTime, setNewTime] = useState("");
  const [scheduleMsg, setScheduleMsg] = useState("");

  const [noticeWard, setNoticeWard] = useState("");
  const [noticeDate, setNoticeDate] = useState("");
  const [noticeType, setNoticeType] = useState("holiday");
  const [noticeDelay, setNoticeDelay] = useState("");
  const [noticeReason, setNoticeReason] = useState("");
  const [noticeMsg, setNoticeMsg] = useState("");

  const loadSchedules = () => getWardSchedules().then(setSchedules);
  useEffect(() => { loadSchedules(); }, []);

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
      const existing = schedules.find((s) => s.ward_number === parseInt(newWard));
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
      setScheduleMsg(err.response?.data ? JSON.stringify(err.response.data) : "Failed to save.");
    }
  };

  const handleCreateNotice = async (e) => {
    e.preventDefault();
    setNoticeMsg("");
    try {
      await createScheduleNotice(noticeWard, noticeDate, noticeType, noticeDelay, noticeReason);
      setNoticeMsg("Notice created.");
      setNoticeWard(""); setNoticeDate(""); setNoticeDelay(""); setNoticeReason("");
    } catch (err) {
      setNoticeMsg(err.response?.data ? JSON.stringify(err.response.data) : "Failed to create.");
    }
  };

  // Map each result status to a pill style. same idea as the
  // compliant/non_compliant pill coloring
  const resultPillClass =
    result?.status === "normal" ? "pill pill-success" :
    result?.status === "delayed" ? "pill pill-warning" :
    "pill pill-neutral";

  return (
    <div className="page-container">
      <span className="eyebrow">COLLECTION SCHEDULING</span>
      <h2>Ward Pickup Schedules</h2>

      <div className="card" style={{ marginBottom: 20 }}>
        <span className="eyebrow">ALL WARD SCHEDULES</span>
        <ul style={{ listStyle: "none", padding: 0, marginTop: 8 }}>
          {schedules.map((s) => (
            <li key={s.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--color-border)" }}>
              Ward {s.ward_number} — {s.pickup_day_display} at {s.pickup_time}
            </li>
          ))}
        </ul>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <span className="eyebrow">CHECK A SPECIFIC DATE</span>
        <form onSubmit={handleCheck} style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <input value={ward} onChange={(e) => setWard(e.target.value)} placeholder="Ward number" type="number" />
          <input value={date} onChange={(e) => setDate(e.target.value)} type="date" />
          <button type="submit" className="btn btn-primary">Check</button>
        </form>
        {error && <p style={{ color: "red" }}>{error}</p>}
        {result && (
          <div style={{ marginTop: 12 }}>
            <span className={resultPillClass}>
              {result.status === "normal" && `Normal pickup at ${result.time}`}
              {result.status === "delayed" && `Delayed to ${result.time} — ${result.reason}`}
              {result.status === "no_pickup" && `No pickup — ${result.reason}`}
            </span>
          </div>
        )}
      </div>

      {isStaff && (
        <>
          <div className="card" style={{ marginBottom: 20 }}>
            <span className="eyebrow">CREATE / UPDATE WARD SCHEDULE (STAFF)</span>
            <form onSubmit={handleCreateSchedule} style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <input value={newWard} onChange={(e) => setNewWard(e.target.value)} placeholder="Ward number" type="number" />
              <select value={newDay} onChange={(e) => setNewDay(e.target.value)}>
                {DAYS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
              <input value={newTime} onChange={(e) => setNewTime(e.target.value)} type="time" />
              <button type="submit" className="btn btn-primary">Save Schedule</button>
            </form>
            {scheduleMsg && <p>{scheduleMsg}</p>}
          </div>

          <div className="card">
            <span className="eyebrow">CREATE NOTICE (STAFF)</span>
            <form onSubmit={handleCreateNotice} style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <input value={noticeWard} onChange={(e) => setNoticeWard(e.target.value)} placeholder="Ward (blank = citywide)" />
              <input value={noticeDate} onChange={(e) => setNoticeDate(e.target.value)} type="date" />
              <select value={noticeType} onChange={(e) => setNoticeType(e.target.value)}>
                <option value="holiday">Holiday</option>
                <option value="delay">Delay</option>
              </select>
              {noticeType === "delay" && (
                <input value={noticeDelay} onChange={(e) => setNoticeDelay(e.target.value)} type="time" />
              )}
              <input value={noticeReason} onChange={(e) => setNoticeReason(e.target.value)} placeholder="Reason" />
              <button type="submit" className="btn btn-accent">Create Notice</button>
            </form>
            {noticeMsg && <p>{noticeMsg}</p>}
          </div>
        </>
      )}
    </div>
  );
}

export default Scheduling;