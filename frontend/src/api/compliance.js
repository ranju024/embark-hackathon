import api from "../api";

export const createComplianceCheck = async (qrCode, photoFile, notes) => {
  const formData = new FormData();
  formData.append("qr_code", qrCode);
  formData.append("photo", photoFile);
  formData.append("notes", notes);
  //  .append(fieldName, value). the field names match DRF serializer's
  // field names exactly (qr_code, photo, status, notes) 

  const res = await api.post("/compliance-checks/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
};

export const getComplianceHistory = async (householdQr) => {
  const res = await api.get(`/compliance-checks/?household_qr=${householdQr}`);
  return res.data;
};

export const getPendingReviews = async () => {
  const res = await api.get("/compliance-checks/?status=pending_review");
  return res.data;
};
 
export const reviewComplianceCheck = async (id, status, notes) => {
  const res = await api.patch(`/compliance-checks/${id}/review/`, {
    status,
    notes,
  });
  return res.data;
};