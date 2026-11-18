import { useEffect, useState } from "react";
import { getPartnerOffers, getMyRedemptions, redeemOffer } from "../api/rewards";
import { getMyHousehold } from "../api/households";
import { isLoggedIn } from "../auth";
import BrandLogo from "../components/BrandLogo";
import { Alert, EmptyState, PageHeader, Spinner, StatusPill } from "../components/ui";
import { formatApiError } from "../lib/errors";

function RewardsHub() {
  const [offers, setOffers] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [redeemingId, setRedeemingId] = useState(null);
  const [error, setError] = useState("");
  const [justRedeemed, setJustRedeemed] = useState(null);
  const [copied, setCopied] = useState(false);

  const loadData = async () => {
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
      setLoadError("Couldn't load the rewards. Please refresh the page.");
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
    setCopied(false);
    setRedeemingId(offerId);
    try {
      const redemption = await redeemOffer(offerId);
      setJustRedeemed(redemption);
      await loadData();
    } catch (err) {
      setError(formatApiError(err, "Could not redeem this offer."));
    } finally {
      setRedeemingId(null);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(justRedeemed.voucher_code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  if (loading) return <div className="page-container"><Spinner /></div>;
  if (loadError) return <div className="page-container"><Alert kind="error">{loadError}</Alert></div>;

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="REWARDS HUB"
        title="Redeem your GreenPoints"
        subtitle="Swap your points for vouchers. Show the voucher code to the partner."
      />

      <section className="header-banner">
        <div className="stat-pill" style={{ marginTop: 0 }}>
          <span className="stat-value">{totalPoints}</span>
          <span className="stat-label">GreenPoints available</span>
        </div>
      </section>

      {justRedeemed && (
        <div className="card voucher mb">
          <div className="offer-top">
            <BrandLogo
              name={justRedeemed.offer.partner_name}
              image={justRedeemed.offer.image}
              color={justRedeemed.offer.brand_color}
            />
            <div>
              <span className="eyebrow">Voucher ready</span>
              <h3>{justRedeemed.offer.title}</h3>
            </div>
          </div>
          <p className="voucher-code mt-sm">{justRedeemed.voucher_code}</p>
          <div className="actions">
            <button className="btn btn-primary btn-sm" onClick={copyCode}>{copied ? "Copied" : "Copy code"}</button>
          </div>
          <p className="muted mt-sm" style={{ marginBottom: 0 }}>
            Show this code to {justRedeemed.offer.partner_name} to claim your reward.
          </p>
        </div>
      )}

      <Alert kind="error">{error}</Alert>

      {offers.length === 0 ? (
        <div className="card">
          <EmptyState icon="gift" title="No offers yet">New rewards will appear here soon.</EmptyState>
        </div>
      ) : (
        <div className="grid-auto">
          {offers.map((offer) => {
            const canAfford = totalPoints >= offer.points_cost;
            return (
              <div key={offer.id} className="card offer-card">
                <div className="offer-top">
                  <BrandLogo name={offer.partner_name} image={offer.image} color={offer.brand_color} />
                  <div>
                    <span className="eyebrow" style={{ marginBottom: 0 }}>{offer.partner_name}</span>
                    <h3 style={{ marginBottom: 0 }}>{offer.title}</h3>
                  </div>
                </div>
                {offer.description && <p className="muted" style={{ marginBottom: 0 }}>{offer.description}</p>}
                <div className="offer-foot">
                  <span className="pill pill-neutral">{offer.points_cost} pts</span>
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={!canAfford || redeemingId === offer.id}
                    onClick={() => handleRedeem(offer.id)}
                  >
                    {redeemingId === offer.id
                      ? "Redeeming..."
                      : canAfford
                        ? "Redeem"
                        : `${offer.points_cost - totalPoints} more pts`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="note">Partner offers are examples for now. Real partnerships are not active yet.</p>

      <div className="card mt">
        <div className="card-header">
          <span className="eyebrow">Your redemption history</span>
        </div>
        {redemptions.length === 0 ? (
          <EmptyState icon="gift" title="Nothing redeemed yet">Your vouchers will show up here.</EmptyState>
        ) : (
          redemptions.map((r) => (
            <div key={r.id} className="list-item wrap-mobile">
              <div className="media" style={{ flex: 1, minWidth: 0 }}>
                <BrandLogo name={r.offer.partner_name} image={r.offer.image} color={r.offer.brand_color} size={44} />
                <div className="media-body">
                  <p className="list-item-title">{r.offer.title}</p>
                  <p className="list-item-meta">
                    {r.offer.partner_name} · {r.voucher_code} · {new Date(r.redeemed_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <StatusPill status={r.is_used ? "completed" : "scheduled"}>
                {r.is_used ? "Used" : "Unused"} · -{r.points_spent} pts
              </StatusPill>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default RewardsHub;