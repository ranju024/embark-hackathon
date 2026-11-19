import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getMyHousehold, getHouseholds } from "../api/households";
import QrImage from "../components/QrImage";
import { getMyPoints } from "../api/rewards";
import { getMyRoutes } from "../api/collectorRoutes";
import LiveTruckMap from "../components/LiveTruckMap";
import Icon from "../components/Icon";
import { Alert, EmptyState, PageHeader, Spinner } from "../components/ui";
import { isLoggedIn } from "../auth";

const TIER_CLASS = {
  "Bronze": "tier-bronze",
  "Silver": "tier-silver",
  "Gold": "tier-gold",
  "Eco Champion": "tier-eco-champion",
};

const ROUTE_POLL_INTERVAL_MS = 15000;
const HISTORY_PREVIEW = 8;

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

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
  else when = dayLabel;

  let text = `Next pickup: ${when} · ${timeLabel}`;
  if (nextPickup.is_delayed) {
    text += ` (delayed${nextPickup.reason ? " — " + nextPickup.reason : ""})`;
  }
  return text;
}

function pointsEntryLabel(entry) {
  if (entry.redemption) return "Reward redeemed";
  return entry.points > 0 ? "Compliant waste check" : "Non-compliant waste check";
}

function BadgeAndProgress({ badgeInfo }) {
  if (!badgeInfo) return null;
  const tierClass = TIER_CLASS[badgeInfo.tier] || "tier-bronze";

  return (
    <div className="banner-panel">
      <span className={`badge-pill ${tierClass}`}>{badgeInfo.tier}</span>
      <div className="progress-track">
        <div className={`progress-fill ${tierClass}`} style={{ width: `${badgeInfo.progress_percent}%` }} />
      </div>
      <small style={{ opacity: 0.85 }}>
        {badgeInfo.next_tier
          ? `${badgeInfo.points_to_next_tier} points to ${badgeInfo.next_tier}`
          : "Highest tier reached"}
      </small>
    </div>
  );
}

function Households({ isStaff }) {
  const [myHousehold, setMyHousehold] = useState(null);
  const [allHouseholds, setAllHouseholds] = useState([]);
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeRoute, setActiveRoute] = useState(null);
  const [query, setQuery] = useState("");
  const [showAllHistory, setShowAllHistory] = useState(false);
  const pollRef = useRef(null);

  const loadData = async () => {
    setLoading(true);
    setLoadError("");
    try {
      if (isStaff) {
        setAllHouseholds(await getHouseholds());
      } else {
        const household = await getMyHousehold();
        setMyHousehold(household);
        if (household) setPoints(await getMyPoints());
      }
    } catch (e) {
      console.error(e);
      setLoadError("Couldn't load your household. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  const pollActiveRoute = async () => {
    try {
      setActiveRoute(await getMyRoutes());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isLoggedIn()) loadData();
    else setLoading(false);
  }, [isStaff]);

  useEffect(() => {
    if (!isLoggedIn() || isStaff) return undefined;
    pollActiveRoute();
    pollRef.current = setInterval(pollActiveRoute, ROUTE_POLL_INTERVAL_MS);
    return () => clearInterval(pollRef.current);
  }, [isStaff]);

  const filteredHouseholds = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allHouseholds;
    return allHouseholds.filter((h) =>
      `${h.owner_name} ${h.owner_username} ${h.house_number} ward ${h.ward_number}`.toLowerCase().includes(q)
    );
  }, [allHouseholds, query]);

  const sortedPoints = useMemo(
    () => [...points].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [points]
  );

  if (!isLoggedIn()) {
    return (
      <div className="page-container">
        <EmptyState
          icon="users"
          title="Log in to see your household"
          action={<Link to="/login" className="btn btn-primary">Log in</Link>}
        >
          Your dashboard, points and QR code live here.
        </EmptyState>
      </div>
    );
  }
  if (loading) return <div className="page-container"><Spinner /></div>;
  if (loadError) return <div className="page-container"><Alert kind="error">{loadError}</Alert></div>;

  /* ------------------------------------------------------------ staff */
  if (isStaff) {
    return (
      <div className="page-container">
        <PageHeader
          eyebrow="WARD ADMIN"
          title="Registered households"
          subtitle={`${allHouseholds.length} household${allHouseholds.length === 1 ? "" : "s"} registered.`}
        />
        <input
          className="mb"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, house number or ward"
          aria-label="Search households"
        />
        {filteredHouseholds.length === 0 ? (
          <div className="card">
            <EmptyState icon="users" title="No households found">
              {allHouseholds.length === 0 ? "Nobody has registered yet." : "Try a different search."}
            </EmptyState>
          </div>
        ) : (
          <div className="grid-auto">
            {filteredHouseholds.map((h) => (
              <div key={h.id} className="card media">
                <QrImage className="qr-small" householdId={h.id} alt={`QR code for Ward ${h.ward_number}, House ${h.house_number}`} />
                <div className="media-body">
                  <p className="list-item-title">Ward {h.ward_number} — House {h.house_number}</p>
                  <p className="list-item-meta">{h.owner_name} · {h.owner_username}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* --------------------------------------------------------- resident */
  if (!myHousehold) {
    return (
      <div className="page-container">
        <div className="card">
          <EmptyState
            icon="home"
            title="Join Waste Warrior"
            action={<Link to="/onboarding" className="btn btn-primary">Start registration</Link>}
          >
            Register your household to get your QR code and start earning GreenPoints.
          </EmptyState>
        </div>
      </div>
    );
  }

  const complianceEntries = points.filter((p) => p.compliance_check != null);
  const compliantCount = complianceEntries.filter((p) => p.points > 0).length;
  const complianceRate =
    complianceEntries.length > 0 ? Math.round((compliantCount / complianceEntries.length) * 100) : null;
  const totalPoints = myHousehold.badge_info?.total_points ?? points.reduce((sum, entry) => sum + entry.points, 0);
  const visibleHistory = showAllHistory ? sortedPoints : sortedPoints.slice(0, HISTORY_PREVIEW);

  return (
    <div className="page-container">
      <section className="header-banner">
        <span className="eyebrow">{greeting()}</span>
        <h2>{myHousehold.owner_name}</h2>
        <p style={{ marginBottom: 0 }}>H.No {myHousehold.house_number} · Ward {myHousehold.ward_number}</p>

        <div className="banner-stats">
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
        </div>

        <BadgeAndProgress badgeInfo={myHousehold.badge_info} />

        <p className={`pickup-countdown ${myHousehold.next_pickup?.is_delayed ? "is-delayed" : ""}`}>
          <Icon name="calendar" size={16} />
          {formatPickupCountdown(myHousehold.next_pickup)}
        </p>
      </section>

      {activeRoute && (
        <div className="card mb">
          <div className="card-header">
            <span className="eyebrow">Collector on the way</span>
          </div>
          {activeRoute.current_lat && activeRoute.current_lng ? (
            <LiveTruckMap lat={activeRoute.current_lat} lng={activeRoute.current_lng} label="Your collector" />
          ) : (
            <p className="muted" style={{ marginBottom: 0 }}>
              Your collector has started their route. Waiting for their first location update.
            </p>
          )}
        </div>
      )}

      <div className="dashboard-grid">
        <div className="card">
          <div className="card-header">
            <span className="eyebrow">Points history</span>
            {sortedPoints.length > 0 && <span className="muted">{sortedPoints.length} entries</span>}
          </div>

          {sortedPoints.length === 0 ? (
            <EmptyState icon="star" title="No activity yet">
              Your points will appear here after your first waste check.
            </EmptyState>
          ) : (
            <>
              {visibleHistory.map((p) => (
                <div key={p.id} className="list-item">
                  <div className="list-item-main">
                    <p className="list-item-title">{pointsEntryLabel(p)}</p>
                    <p className="list-item-meta">{new Date(p.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className={p.points > 0 ? "pill pill-success" : "pill pill-warning"}>
                    {p.points > 0 ? "+" : ""}{p.points} pts
                  </span>
                </div>
              ))}
              {sortedPoints.length > HISTORY_PREVIEW && (
                <div className="actions mt">
                  <button className="btn btn-outline btn-sm" onClick={() => setShowAllHistory((v) => !v)}>
                    {showAllHistory ? "Show fewer" : `Show all ${sortedPoints.length}`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="stack-lg">
          <div className="card qr-card">
            <div className="card-header">
              <span className="eyebrow">Your household QR</span>
            </div>
            <QrImage className="qr-img" householdId={myHousehold.id} alt="Your household QR code" />
            <p className="muted mt-sm" style={{ marginBottom: 0 }}>Show this to your collector at pickup.</p>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="eyebrow">Quick links</span>
            </div>
            <div className="actions">
              <Link to="/services" className="btn btn-outline btn-sm">My perks</Link>
              <Link to="/rewards" className="btn btn-outline btn-sm">Rewards</Link>
              <Link to="/complaints" className="btn btn-outline btn-sm">Complaints</Link>
              <Link to="/subscriptions" className="btn btn-outline btn-sm">Plans</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Households;