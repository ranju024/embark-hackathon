import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  createScheduleNotice, createWardSchedule, deleteScheduleNotice, getEffectiveSchedule,
  getScheduleNotices, getWardSchedules, updateWardSchedule,
} from "../api/scheduling";
import { getMyHousehold } from "../api/households";
import { isLoggedIn } from "../auth";
import { Alert, EmptyState, Field, PageHeader, Spinner } from "../components/ui";
import { formatApiError } from "../lib/errors";
import { formatDate, formatTime, todayIso } from "../lib/dates";

const WARDS = Array.from({ length: 29 }, (_, i) => i + 1);
const DAYS = [
  [0, "Monday"], [1, "Tuesday"], [2, "Wednesday"], [3, "Thursday"],
  [4, "Friday"], [5, "Saturday"], [6, "Sunday"],
];

function upcoming(notices) {
  const today = todayIso();
  return notices.filter((n) => n.date >= today).sort((a, b) => a.date.localeCompare(b.date));
}

function NoticeRow({ notice, onRemove }) {
  const where = notice.ward_number ? `Ward ${notice.ward_number}` : "All wards";
  const isHoliday = notice.notice_type === "holiday";
  return (
    <div className="list-item wrap-mobile">
      <div className="list-item-main">
        <p className="list-item-title">{formatDate(notice.date)} · {where}</p>
        {notice.reason && <p className="list-item-meta">{notice.reason}</p>}
      </div>
      <div className="row">
        <span className={`pill ${isHoliday ? "pill-neutral" : "pill-warning"}`}>
          {isHoliday ? "No pickup" : `Delayed to ${formatTime(notice.delayed_to_time)}`}
        </span>
        {onRemove && (
          <button type="button" className="btn btn-outline btn-sm" onClick={() => onRemove(notice.id)}>Remove</button>
        )}
      </div>
    </div>
  );
}

function NoticesCard({ title, notices, onRemove, error }) {
  const list = upcoming(notices);
  return (
    <div className="card mb">
      <div className="card-header"><span className="eyebrow">{title}</span></div>
      <Alert kind="error">{error}</Alert>
      {list.length === 0 ? (
        <EmptyState icon="calendar" title="No upcoming notices">Pickups are running as normal.</EmptyState>
      ) : (
        list.map((n) => <NoticeRow key={n.id} notice={n} onRemove={onRemove} />)
      )}
    </div>
  );
}

/* Check any ward on any date: for residents looking at another ward, and for staff. */
function LookupCard() {
  const [ward, setWard] = useState("");
  const [date, setDate] = useState(todayIso());
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCheck = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);
    try {
      setResult(await getEffectiveSchedule(ward, date));
    } catch (err) {
      setError(
        err.response?.status === 404
          ? `Ward ${ward} has no pickup schedule yet.`
          : formatApiError(err, "Could not check the schedule.")
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card mb">
      <div className="card-header"><span className="eyebrow">Check any ward and date</span></div>
      <form onSubmit={handleCheck} className="stack">
        <Field label="Ward number">
          <input type="number" min="1" max="29" inputMode="numeric" value={ward} onChange={(e) => setWard(e.target.value)} required />
        </Field>
        <Field label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Checking..." : "Check"}
        </button>
      </form>
      <Alert kind="error">{error}</Alert>
      {result?.status === "normal" && (
        <Alert kind="success">Ward {ward}: normal pickup at {formatTime(result.time)}.</Alert>
      )}
      {result?.status === "delayed" && (
        <Alert kind="warning">Ward {ward}: delayed to {formatTime(result.time)}. {result.reason}</Alert>
      )}
      {result?.status === "no_pickup" && (
        <Alert kind="info">Ward {ward}: no pickup. {result.reason}</Alert>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- resident */

function ResidentView({ household, schedules, notices }) {
  if (!household) {
    return (
      <>
        <div className="card mb">
          <EmptyState
            icon="home"
            title="Register your household"
            action={<Link to="/onboarding" className="btn btn-primary">Start registration</Link>}
          >
            Once you're registered, your own ward's schedule shows up here automatically.
          </EmptyState>
        </div>
        <LookupCard />
      </>
    );
  }

  const mine = schedules.find((s) => s.ward_number === household.ward_number);
  const next = household.next_pickup;

  return (
    <>
      <div className="card mb">
        <div className="card-header"><span className="eyebrow">Your ward · Ward {household.ward_number}</span></div>
        {mine ? (
          <>
            <p className="big-when">Every {mine.pickup_day_display}</p>
            <p className="muted" style={{ marginBottom: 0 }}>at {formatTime(mine.pickup_time)}</p>
          </>
        ) : (
          <EmptyState icon="calendar" title="No schedule yet">
            Your ward doesn't have a pickup schedule yet. Check back soon.
          </EmptyState>
        )}
        {next && (
          <div className="callout">
            <strong>Next pickup:</strong> {formatDate(next.date)} at {formatTime(next.time)}
            {next.is_delayed ? ` (delayed${next.reason ? `: ${next.reason}` : ""})` : ""}
          </div>
        )}
      </div>

      <NoticesCard title={`Upcoming notices for Ward ${household.ward_number}`} notices={notices} />
      <LookupCard />
    </>
  );
}

/* ------------------------------------------------------------------ staff */

function StaffView({ schedules, notices, onChanged }) {
  const byWard = useMemo(() => new Map(schedules.map((s) => [s.ward_number, s])), [schedules]);
  const formRef = useRef(null);

  const [sched, setSched] = useState({ ward: "", day: "0", time: "" });
  const [schedMsg, setSchedMsg] = useState("");
  const [schedErr, setSchedErr] = useState("");

  const [notice, setNotice] = useState({ ward: "", date: "", type: "holiday", delay: "", reason: "" });
  const [noticeMsg, setNoticeMsg] = useState("");
  const [noticeErr, setNoticeErr] = useState("");
  const [listErr, setListErr] = useState("");

  const editWard = (ward) => {
    const existing = byWard.get(ward);
    setSched({
      ward: String(ward),
      day: existing ? String(existing.pickup_day) : "0",
      time: existing ? existing.pickup_time.slice(0, 5) : "",
    });
    setSchedMsg("");
    setSchedErr("");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    setSchedMsg("");
    setSchedErr("");
    if (!sched.ward || !sched.time) {
      setSchedErr("Choose a ward and a time.");
      return;
    }
    const existing = byWard.get(Number(sched.ward));
    try {
      if (existing) await updateWardSchedule(existing.id, sched.day, sched.time);
      else await createWardSchedule(sched.ward, sched.day, sched.time);
      setSchedMsg(existing ? "Schedule updated." : "Schedule created.");
      onChanged();
    } catch (err) {
      setSchedErr(formatApiError(err, "Could not save the schedule."));
    }
  };

  const handleCreateNotice = async (e) => {
    e.preventDefault();
    setNoticeMsg("");
    setNoticeErr("");
    try {
      await createScheduleNotice(notice.ward, notice.date, notice.type, notice.delay, notice.reason);
      setNoticeMsg("Notice created.");
      setNotice({ ward: "", date: "", type: "holiday", delay: "", reason: "" });
      onChanged();
    } catch (err) {
      setNoticeErr(formatApiError(err, "Could not create the notice."));
    }
  };

  const handleRemoveNotice = async (id) => {
    setListErr("");
    try {
      await deleteScheduleNotice(id);
      onChanged();
    } catch (err) {
      setListErr(formatApiError(err, "Could not remove the notice."));
    }
  };

  return (
    <>
      <div className="card mb">
        <div className="card-header">
          <span className="eyebrow">All wards</span>
          <span className="muted">{byWard.size} of {WARDS.length} have a schedule</span>
        </div>
        <div className="ward-grid">
          {WARDS.map((ward) => {
            const s = byWard.get(ward);
            return (
              <div key={ward} className={`ward-tile${s ? "" : " empty"}`}>
                <p className="ward-no">Ward {ward}</p>
                <p className="ward-when">
                  {s ? `${s.pickup_day_display}, ${formatTime(s.pickup_time)}` : "No schedules yet"}
                </p>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => editWard(ward)}>
                  {s ? "Edit" : "Set schedule"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card mb" ref={formRef}>
        <div className="card-header"><span className="eyebrow">Create or update a ward schedule</span></div>
        <form onSubmit={handleSaveSchedule} className="stack">
          <Field label="Ward">
            <select value={sched.ward} onChange={(e) => setSched({ ...sched, ward: e.target.value })} required>
              <option value="">Select a ward</option>
              {WARDS.map((w) => <option key={w} value={w}>Ward {w}</option>)}
            </select>
          </Field>
          <Field label="Pickup day">
            <select value={sched.day} onChange={(e) => setSched({ ...sched, day: e.target.value })}>
              {DAYS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field label="Pickup time">
            <input type="time" value={sched.time} onChange={(e) => setSched({ ...sched, time: e.target.value })} required />
          </Field>
          <button type="submit" className="btn btn-primary">Save schedule</button>
        </form>
        <Alert kind="success">{schedMsg}</Alert>
        <Alert kind="error">{schedErr}</Alert>
      </div>

      <NoticesCard title="Upcoming notices" notices={notices} onRemove={handleRemoveNotice} error={listErr} />

      <div className="card mb">
        <div className="card-header"><span className="eyebrow">Create a notice</span></div>
        <form onSubmit={handleCreateNotice} className="stack">
          <Field label="Ward">
            <select value={notice.ward} onChange={(e) => setNotice({ ...notice, ward: e.target.value })}>
              <option value="">All wards</option>
              {WARDS.map((w) => <option key={w} value={w}>Ward {w}</option>)}
            </select>
          </Field>
          <Field label="Date">
            <input type="date" min={todayIso()} value={notice.date} onChange={(e) => setNotice({ ...notice, date: e.target.value })} required />
          </Field>
          <Field label="Type">
            <select value={notice.type} onChange={(e) => setNotice({ ...notice, type: e.target.value })}>
              <option value="holiday">Holiday (no pickup)</option>
              <option value="delay">Delay</option>
            </select>
          </Field>
          {notice.type === "delay" && (
            <Field label="Delayed to">
              <input type="time" value={notice.delay} onChange={(e) => setNotice({ ...notice, delay: e.target.value })} required />
            </Field>
          )}
          <Field label="Reason">
            <input value={notice.reason} onChange={(e) => setNotice({ ...notice, reason: e.target.value })} maxLength={200} placeholder="e.g. Public holiday" />
          </Field>
          <button type="submit" className="btn btn-accent">Create notice</button>
        </form>
        <Alert kind="success">{noticeMsg}</Alert>
        <Alert kind="error">{noticeErr}</Alert>
      </div>

      <LookupCard />
    </>
  );
}

/* ------------------------------------------------------------------- page */

function Scheduling({ isStaff }) {
  const loggedIn = isLoggedIn();
  const [schedules, setSchedules] = useState([]);
  const [notices, setNotices] = useState([]);
  const [household, setHousehold] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const load = async () => {
    setLoadError("");
    try {
      setSchedules(await getWardSchedules());
      if (isStaff) {
        setNotices(await getScheduleNotices());
      } else if (loggedIn) {
        const mine = await getMyHousehold();
        setHousehold(mine);
        if (mine) setNotices(await getScheduleNotices(mine.ward_number));
      }
    } catch (e) {
      console.error(e);
      setLoadError("Couldn't load schedules. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [isStaff]);

  if (loading) return <div className="page-container"><Spinner /></div>;
  if (loadError) return <div className="page-container"><Alert kind="error">{loadError}</Alert></div>;

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="COLLECTION SCHEDULING"
        title={isStaff ? "Ward pickup schedules" : "Pickup schedules"}
        subtitle={
          isStaff
            ? "Set each ward's weekly pickup and post holiday or delay notices."
            : "See when your ward's waste is collected, or check another ward."
        }
      />
      {isStaff ? (
        <StaffView schedules={schedules} notices={notices} onChanged={load} />
      ) : loggedIn ? (
        <ResidentView household={household} schedules={schedules} notices={notices} />
      ) : (
        <>
          <Alert kind="info">
            <Link to="/login">Log in</Link> to see your own ward's schedule automatically.
          </Alert>
          <LookupCard />
        </>
      )}
    </div>
  );
}

export default Scheduling;