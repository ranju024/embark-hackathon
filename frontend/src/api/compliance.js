import api from "../api";

// Find a household by ward + house number, or by a scanned QR code. Staff only.
export const lookupHousehold = async ({ ward, house, qr }) => {
  const params = qr ? { qr } : { ward, house };
  const res = await api.get("/households/lookup/", { params });
  return res.data;
};

export const createComplianceCheck = async ({ householdId, photos, wasteType, weightKg, notes }) => {
  const formData = new FormData();
  formData.append("household_id", householdId);
  photos.forEach((file) => formData.append("photos", file));
  formData.append("waste_type", wasteType);
  formData.append("weight_kg", weightKg);
  formData.append("notes", notes || "");

  const res = await api.post("/compliance-checks/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
};

export const getPendingReviews = async () => {
  const res = await api.get("/compliance-checks/", { params: { status: "pending_review" } });
  return res.data;
};

export const reviewComplianceCheck = async (id, status, notes = "") => {
  const res = await api.patch(`/compliance-checks/${id}/review/`, { status, notes });
  return res.data;
};