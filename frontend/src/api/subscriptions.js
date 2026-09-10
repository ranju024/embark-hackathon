import api from "../api";

export const getSubscriptionPlans = async () => {
  const res = await api.get("/subscriptions/plans/");
  return res.data;
};

export const getMySubscription = async () => {
  const res = await api.get("/subscriptions/my-subscription/");
  return res.data;
};

export const subscribeToPlan = async (planId) => {
  const res = await api.post("/subscriptions/subscribe/", { plan_id: planId });
  return res.data;
};

export const verifyEsewaPayment = async (data) => {
  const res = await api.post("/subscriptions/verify-payment/", { data });
  return res.data;
};

export const redirectToEsewa = (esewaFormUrl, formFields) => {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = esewaFormUrl;

  Object.entries(formFields).forEach(([key, value]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = value;
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
};