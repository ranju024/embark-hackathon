import api from "../api";

export const getMyPoints = async () => {
  const res = await api.get("/points-entries/");
  return res.data;
};

export const getPartnerOffers = async () => {
  const res = await api.get("/partner-offers/");
  return res.data;
};

export const getMyRedemptions = async () => {
  const res = await api.get("/my-redemptions/");
  return res.data;
};

export const redeemOffer = async (offerId) => {
  const res = await api.post("/redeem/", { offer_id: offerId });
  return res.data;
};