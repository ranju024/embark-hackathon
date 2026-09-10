import { useEffect, useState } from "react";
import {
  getMyHousehold,
  getHouseholds,
  createHousehold,
  getHouseholdQrImageUrl,
} from "../api/households";
import { getMyPoints } from "../api/rewards";
import { isLoggedIn } from "../auth";

const TIER_CLASS = {
  "Bronze": "tier-bronze",
  "Silver": "tier-silver",
  "Gold": "tier-gold",
  "Eco Champion": "tier-eco-champion",
};

function formatPickupCountdown(nextPickup) {
  if (!nextPickup) return "No pickup schedule set for your ward yet.";

  const pickupDate = new Date(`${nextPickup.date}T${nextPickup.time}`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const pickupDay = new Date(pickupDate);
  pickupDay.setHours(0, 0, 0, 0);

  const dayDiff = Math.round((pickupDay - today) / (1000 * 60 * 60 * 24));
  const dayLabel = pickupDate.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  const timeLabel = pickupDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  let when;
  if (dayDiff === 0) when = "Today";
  else if (dayDiff === 1) when = "Tomorrow";
  else when = `${dayLabel}`;

  let text = `Next pickup: ${when} · ${timeLabel}`;
  if (nextPickup.is_delayed) {
    text += ` (delayed${nextPickup.reason ? " — " + nextPickup.reason : ""})`;
  }
  return text;
}

function BadgeAndProgress({ badgeInfo }) {
  if (!badgeInfo) return null;
  const tierClass = TIER_CLASS[badgeInfo.tier] || "tier-bronze";

  return (
    <div style={{ marginTop: 12 }}>
      <span className={`badge-pill ${tierClass}`}>{badgeInfo.tier}</span>
      <div className="progress-track">
        <div
          className={`progress-fill ${tierClass}`}
          style={{ width: `${badgeInfo.progress_percent}%` }}
        />
      </div>
      <p style={{ margin: 0, fontSize: "0.8rem", opacity: 0.8 }}>
        {badgeInfo.next_tier
          ? `${badgeInfo.points_to_next_tier} points to ${badgeInfo.next_tier}`
          : "Highest tier reached"}
      </p>
    </div>
  );
}

function Households({ isStaff }) {
  const [myHousehold, setMyHousehold] = useState(null);
  const [allHouseholds, setAllHouseholds] = useState([]);
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wardNumber, setWardNumber] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [error, setError] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      if (isStaff) {
        const data = await getHouseholds();
        setAllHouseholds(data);
      } else {
        const household = await getMyHousehold();
        setMyHousehold(household);
        if (household) {
          const pointsData = await getMyPoints();
          setPoints(pointsData);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn()) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [isStaff]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await createHousehold(wardNumber, houseNumber, ownerName, phoneNumber);
      loadData();
    } catch (err) {
      setError(err.response?.data ? JSON.stringify(err.response.data) : "Failed to create household");
    }
  };

  if (!isLoggedIn()) {
    return (
      <div className="page-container">
        <p>Please log in or register an account to manage your household.</p>
      </div>
    );
  }
  if (loading) {
    return <div className="page-container"><p>Loading...</p></div>;
  }

  // --- Staff view: all registered households, card grid ---
  if (isStaff) {
    return (
      <div className="page-container">
        <span className="eyebrow">WARD ADMIN</span>
        <h2>All Registered Households</h2>
        {allHouseholds.map((h) => (
          <div key={h.id} className="card" style={{ marginBottom: 12, display: "flex", gap: 16, alignItems: "center" }}>
            <img src={getHouseholdQrImageUrl(h.id)} alt="QR code" width={70} />
            <div>
              <p style={{ margin: 0, fontWeight: 600 }}>Ward {h.ward_number} — House {h.house_number}</p>
              <p style={{ margin: 0, color: "var(--color-text-muted)" }}>{h.owner_name} · owner: {h.owner_username}</p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // --- Resident view ---
  const positiveCount = points.filter((p) => p.points > 0).length;
  const complianceRate = points.length > 0 ? Math.round((positiveCount / points.length) * 100) : null;
  const totalPoints = myHousehold?.badge_info?.total_points ?? points.reduce((sum, entry) => sum + entry.points, 0);

  return (
    <div className="page-container">
      {myHousehold ? (
        <>
          <div className="header-banner">
            <span className="eyebrow">GOOD DAY</span>
            <h2>{myHousehold.owner_name}</h2>
            <p style={{ margin: 0, opacity: 0.8 }}>
              H.No {myHousehold.house_number} · Ward {myHousehold.ward_number}
            </p>

            <div className="stat-pill">
              <span className="stat-value">{totalPoints}</span>
              <span className="stat-label">GreenPoints</span>
            </div>
            {complianceRate !== null && (
              <div className="stat-pill">
                <span className="stat-value">{complianceRate}%</span>
                <span className="stat-label">Compliance rate</span>
              </div>
            )}

            <BadgeAndProgress badgeInfo={myHousehold.badge_info} />

            <p className={`pickup-countdown ${myHousehold.next_pickup?.is_delayed ? "is-delayed" : ""}`}>
              {formatPickupCountdown(myHousehold.next_pickup)}
            </p>
          </div>

          <div className="card" style={{ marginBottom: 16, textAlign: "center" }}>
            <span className="eyebrow">YOUR HOUSEHOLD QR</span>
            <div>
              <img src={getHouseholdQrImageUrl(myHousehold.id)} alt="QR code" width={150} />
            </div>
          </div>

          <div className="card">
            <span className="eyebrow">POINTS HISTORY</span>
            {points.length === 0 && <p>No activity yet.</p>}
            {points.map((p) => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--color-border)" }}>
                <span>{new Date(p.created_at).toLocaleDateString()}</span>
                <span className={p.points > 0 ? "pill pill-success" : "pill pill-warning"}>
                  {p.points > 0 ? "+" : ""}{p.points} pts
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="card">
          <span className="eyebrow">HOUSEHOLD REGISTRATION</span>
          <h2>Join Waste Warrior</h2>
          <p style={{ color: "var(--color-text-muted)" }}>
            Register your household to receive your waste segregation kit and start earning GreenPoints.
          </p>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
            <input value={wardNumber} onChange={(e) => setWardNumber(e.target.value)} placeholder="Ward number" type="number" />
            <input value={houseNumber} onChange={(e) => setHouseNumber(e.target.value)} placeholder="House number" />
            <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Full name" />
            <input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="Phone number" />
            <button type="submit" className="btn btn-primary">Continue →</button>
          </form>
        </div>
      )}
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}

export default Households;