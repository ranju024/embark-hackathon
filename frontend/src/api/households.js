import api from "../api";

export const getMyHousehold = async () => {
  try {
    const res = await api.get("/households/mine/");
    return res.data;
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
};

export const getHouseholds = async () => {
  // For staff, this returns EVERYONE's household
  const res = await api.get("/households/");
  return res.data;
};

export const createHousehold = async (ward_number, house_number, owner_name, phone_number) => {
  const res = await api.post("/households/", {
    ward_number,
    house_number,
    owner_name,
    phone_number,
  });
  return res.data;
};

// QR images need the JWT, which a plain <img src> can't send.
// We fetch the PNG through the axios instance and hand back a blob URL.
// The cache stores promises, so concurrent requests for one id share one fetch.
const qrCache = new Map(); // householdId -> Promise<blobUrl>

export const getHouseholdQrBlobUrl = (householdId) => {
  if (!qrCache.has(householdId)) {
    const promise = api
      .get(`/households/${householdId}/qr_image/`, { responseType: "blob" })
      .then((res) => URL.createObjectURL(res.data))
      .catch((err) => {
        qrCache.delete(householdId); // don't cache failures
        throw err;
      });
    qrCache.set(householdId, promise);
  }
  return qrCache.get(householdId);
};

export const clearQrCache = () => {
  qrCache.forEach((promise) => promise.then((url) => URL.revokeObjectURL(url)).catch(() => {}));
  qrCache.clear();
};

// api.js fires this when a refresh fails or the user logs out.
window.addEventListener("auth:logout", clearQrCache);