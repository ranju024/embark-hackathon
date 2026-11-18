import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getPublicStats } from "../api/stats";
import { isLoggedIn } from "../auth";
import Icon from "../components/Icon";
import { HeroIllustration, TruckIllustration, WasteBag } from "../components/Illustrations";
import { Spinner, Stat } from "../components/ui";

const CITY = "Lalitpur Metropolitan City"; // change if the app is for a different city

const WASTE_TYPES = [
  {
    kind: "organic",
    title: "Organic waste",
    intro: "Wet, food-based waste that can rot.",
    items: ["Vegetable and fruit peels", "Leftover cooked food", "Tea leaves and coffee grounds", "Garden leaves and flowers"],
  },
  {
    kind: "dry",
    title: "Dry waste",
    intro: "Clean, dry items that can often be recycled.",
    items: ["Paper and cardboard", "Plastic bottles and wrappers", "Metal cans and glass", "Old cloth"],
  },
  {
    kind: "special",
    title: "Special waste",
    intro: "Keep these out of your normal bags.",
    items: ["Batteries and electronics", "Medicines", "Light bulbs", "Broken glass and sharp items"],
    warn: true,
    note: "Ask your ward office how to hand these over.",
  },
];

const STEPS = [
  ["Register your household", "Create an account and get your household's QR code."],
  ["Sort your waste", "Put organic and dry waste in the right bags."],
  ["Collectors check", "A collector scans your QR, photographs and weighs the waste."],
  ["Earn GreenPoints", "Good sorting earns points you can swap for rewards."],
];

const FEATURES = [
  ["clipboard", "Checked pickups", "Every pickup is photographed and reviewed by a ward officer."],
  ["gift", "Rewards that count", "Swap GreenPoints for vouchers in the Rewards Hub."],
  ["alert", "Fair appeals", "Disagree with a result? Appeal it within 7 days."],
  ["star", "Plans for extra help", "Assisted sorting, priority pickup, compost pickup and bulk pickups."],
  ["file", "Monthly reports", "Subscribers get a printable report for their household."],
  ["users", "For the whole ward", "Officers see compliance and complaints for every ward."],
];

function Home() {
  const loggedIn = isLoggedIn();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPublicStats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page-container">
      <section className="hero">
        <div className="hero-grid">
          <div>
            <span className="eyebrow">WASTE MANAGEMENT · {CITY.toUpperCase()}</span>
            <h1>Cleaner wards, one household at a time.</h1>
            <p className="lead">
              Sort your waste, get it checked, and earn rewards for doing it right.
              Track your pickups and your collector, all in one place.
            </p>
            <div className="hero-actions">
              {loggedIn ? (
                <Link to="/households" className="btn btn-primary">Go to my dashboard</Link>
              ) : (
                <>
                  <Link to="/register" className="btn btn-primary">Register your household</Link>
                  <Link to="/subscriptions" className="btn btn-outline">See plans</Link>
                </>
              )}
            </div>
          </div>
          <HeroIllustration className="hero-art" />
        </div>
      </section>

      <section aria-label="Live statistics">
        {loading && <Spinner label="Loading live stats..." />}
        {!loading && stats && (
          <div className="stat-grid">
            <Stat value={stats.total_households} label="Households registered" />
            <Stat value={stats.active_wards} label="Wards active" />
            <Stat value={`${stats.total_weight_kg} kg`} label="Waste tracked" />
            <Stat value={stats.compliance_rate !== null ? `${stats.compliance_rate}%` : "—"} label="Compliance rate" />
          </div>
        )}
      </section>

      <section className="section">
        <span className="eyebrow">KNOW YOUR WASTE</span>
        <h2>What goes where?</h2>
        <div className="grid-auto">
          {WASTE_TYPES.map((type) => (
            <div key={type.kind} className={`card waste-card ${type.kind}`}>
              <div className="waste-art"><WasteBag kind={type.kind} /></div>
              <h3>{type.title}</h3>
              <p className="muted" style={{ marginBottom: 0 }}>{type.intro}</p>
              <ul className={`tick-list${type.warn ? " warn" : ""}`}>
                {type.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
              {type.note && <p className="note">{type.note}</p>}
            </div>
          ))}
        </div>
        <p className="note">Bag colours in these pictures are only illustrations. Use the colour-coded bags you receive.</p>
      </section>

      <section className="section">
        <span className="eyebrow">HOW IT WORKS</span>
        <h2>Four simple steps</h2>
        <div className="steps">
          {STEPS.map(([title, text], i) => (
            <div key={title} className="card">
              <div className="step-num">{i + 1}</div>
              <h3>{title}</h3>
              <p className="muted" style={{ marginBottom: 0 }}>{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="card band hero-grid">
          <div>
            <span className="eyebrow">LIVE TRACKING</span>
            <h2>Know when your collector is close</h2>
            <p className="muted">
              When a collector starts your ward's route, you can follow their truck on a map from your dashboard.
            </p>
            <Link to={loggedIn ? "/households" : "/register"} className="btn btn-primary">
              {loggedIn ? "Open my dashboard" : "Get started"}
            </Link>
          </div>
          <TruckIllustration className="hero-art" />
        </div>
      </section>

      <section className="section">
        <span className="eyebrow">WHAT YOU GET</span>
        <h2>Built for residents and ward officers</h2>
        <div className="grid-auto">
          {FEATURES.map(([icon, title, text]) => (
            <div key={title} className="card">
              <div className="feature-icon"><Icon name={icon} size={22} /></div>
              <h3>{title}</h3>
              <p className="muted" style={{ marginBottom: 0 }}>{text}</p>
            </div>
          ))}
        </div>
      </section>

      {!loggedIn && (
        <section className="section">
          <div className="cta-band">
            <h2>Ready to start earning GreenPoints?</h2>
            <p>Registering takes about a minute, and basic collection stays free.</p>
            <Link to="/register" className="btn btn-primary">Create your account</Link>
          </div>
        </section>
      )}
    </div>
  );
}

export default Home;