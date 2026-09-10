import { useEffect, useState } from "react";
import { getPartnerOffers, getMyRedemptions, redeemOffer } from "../api/rewards";
import { getMyHousehold } from "../api/households";
import { isLoggedIn } from "../auth";

function RewardsHub() {
  const [offers, setOffers] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [redeemingId, setRedeemingId] = useState(null);
  const [error, setError] = useState("");
  const [justRedeemed, setJustRedeemed] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [offersData, redemptionsData, household] = await Promise.all([
        getPartnerOffers(),
        getMyRedemptions(),
        getMyHousehold(),
      ]);
      setOffers(offersData);
      setRedemptions(redemptionsData);
      setTotalPoints(household?.badge_info?.total_points ?? 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn()) loadData();
    else setLoading(false);
  }, []);

  const handleRedeem = async (offerId) => {
    setError("");
    setJustRedeemed(null);
    setRedeemingId(offerId);
    try {
      const redemption = await redeemOffer(offerId);
      setJustRedeemed(redemption);
      await loadData(); // refresh balance + redemption history
    } catch (err) {
      setError(err.response?.data?.detail || "Could not redeem this offer.");
    } finally {
      setRedeemingId(null);
    }
  };

  if (!isLoggedIn()) {
    return <div className="page-container"><p>Please log in to view the Rewards Hub.</p></div>;
  }
  if (loading) {
    return <div className="page-container"><p>Loading...</p></div>;
  }

  return (
    <div className="page-container">
      <span className="eyebrow">REWARDS HUB</span>
      <h2>Redeem your GreenPoints</h2>

      <div className="header-banner" style={{ marginBottom: 16 }}>
        <span className="stat-value" style={{ fontSize: "2rem" }}>{totalPoints}</span>
        <span className="stat-label">GreenPoints available</span>
      </div>

      {justRedeemed && (
        <div className="card" style={{ marginBottom: 16, border: "2px solid #1B4332" }}>
          <span className="eyebrow">VOUCHER READY</span>
          <p style={{ fontSize: "1.3rem", fontWeight: 700, margin: "6px 0" }}>{justRedeemed.voucher_code}</p>
          <p style={{ color: "var(--color-text-muted)" }}>
            Show this code to {justRedeemed.offer.partner_name} to claim: {justRedeemed.offer.title}
          </p>
        </div>
      )}

      {error && <p style={{ color: "red" }}>{error}</p>}

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        {offers.map((offer) => {
          const canAfford = totalPoints >= offer.points_cost;
          return (
            <div key={offer.id} className="card" style={{ flex: "1 1 260px" }}>
              <span className="eyebrow">{offer.partner_name.toUpperCase()}</span>
              <p style={{ fontWeight: 600, margin: "6px 0" }}>{offer.title}</p>
              <p style={{ color: "var(--color-text-muted)" }}>{offer.description}</p>
              <p style={{ fontWeight: 700 }}>{offer.points_cost} pts</p>
              <button
                className="btn btn-primary"
                disabled={!canAfford || redeemingId === offer.id}
                onClick={() => handleRedeem(offer.id)}
              >
                {redeemingId === offer.id ? "Redeeming..." : canAfford ? "Redeem" : "Not enough points"}
              </button>
            </div>
          );
        })}
      </div>

      <div className="card">
        <span className="eyebrow">YOUR REDEMPTION HISTORY</span>
        {redemptions.length === 0 && <p>No redemptions yet.</p>}
        {redemptions.map((r) => (
          <div key={r.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--color-border)" }}>
            <div>
              <p style={{ margin: 0, fontWeight: 600 }}>{r.offer.title} — {r.offer.partner_name}</p>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
                {r.voucher_code} · {new Date(r.redeemed_at).toLocaleDateString()}
              </p>
            </div>
            <span className={`pill ${r.is_used ? "pill-warning" : "pill-success"}`}>
              {r.is_used ? "Used" : "Unused"} · -{r.points_spent} pts
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default RewardsHub;