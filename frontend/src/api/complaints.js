import api from "../api";

export const getComplaints = async (status, ward) => {
  const params = {};
  if (status) params.status = status;
  if (ward) params.ward = ward;
  const res = await api.get("/complaints/", { params });
  return res.data;
};

export const getAppealableChecks = async () => {
  const res = await api.get("/complaints/appealable-checks/");
  return res.data;
};

export const fileComplaint = async ({ category, description, complianceCheckId, photo }) => {
  const formData = new FormData();
  formData.append("category", category);
  formData.append("description", description);
  if (complianceCheckId) formData.append("compliance_check", complianceCheckId);
  if (photo) formData.append("photo", photo);

  const res = await api.post("/complaints/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
};

export const startComplaintReview = async (id) => {
  const res = await api.post(`/complaints/${id}/review/`);
  return res.data;
};

export const resolveComplaint = async (id, status, resolutionNotes) => {
  const res = await api.post(`/complaints/${id}/resolve/`, {
    status,
    resolution_notes: resolutionNotes,
  });
  return res.data;
};