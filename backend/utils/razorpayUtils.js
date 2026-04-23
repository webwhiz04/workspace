import config from "../config/config.js";

const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";

export const getRazorpayCredentials = () => {
  const keyId = String(config.RAZORPAY_KEY_ID || "").trim();
  const keySecret = String(config.RAZORPAY_KEY_SECRET || "").trim();

  if (!keyId || !keySecret) {
    return { error: "Razorpay credentials are not configured" };
  }

  return { keyId, keySecret };
};

export const createRazorpayAuthHeader = (keyId, keySecret) => {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
};

export const readRazorpayResponse = async (response) => {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage =
      data?.error?.description ||
      data?.error?.reason ||
      data?.error?.message ||
      "Unable to process Razorpay request";
    throw new Error(errorMessage);
  }

  return data;
};

export const createRazorpayOrder = async ({ amount, currency = "INR", receipt }) => {
  const credentials = getRazorpayCredentials();

  if (credentials.error) {
    return { error: credentials.error };
  }

  const response = await fetch(`${RAZORPAY_API_BASE}/orders`, {
    method: "POST",
    headers: {
      Authorization: createRazorpayAuthHeader(credentials.keyId, credentials.keySecret),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount,
      currency,
      receipt,
      payment_capture: 1,
    }),
  });

  const data = await readRazorpayResponse(response);
  return { order: data };
};
