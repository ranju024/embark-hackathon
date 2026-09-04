import api from "../api";

export const createComplianceCheck = async (qrCode, photoFile, status, notes) => {
  const formData = new FormData();

  formData.append("qr_code", qrCode);
  formData.append("photo", photoFile);
  formData.append("status", status);
  formData.append("notes", notes);
  //  .append(fieldName, value). the field names match your DRF serializer's
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