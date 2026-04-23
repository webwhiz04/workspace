import crypto from "crypto";
import {
  getRazorpayCredentials,
  createRazorpayOrder as createRPOrder,
} from "../utils/razorpayUtils.js";

export const getRazorpayConfig = async (_req, res) => {
  try {
    const credentials = getRazorpayCredentials();

    if (credentials.error) {
      return res.status(500).json({ message: credentials.error });
    }

    return res.status(200).json({
      keyId: credentials.keyId,
      currency: "INR",
    });
  } catch (error) {
    console.error("Fetch Razorpay Config Error:", error);
    return res.status(500).json({ message: "Server error while fetching payment config" });
  }
};

export const createOrder = async (req, res) => {
  try {
    const { amount, currency, receipt } = req.body;
    const numericAmount = Number(amount || 0);

    if (!Number.isFinite(numericAmount) || numericAmount < 1) {
      return res.status(400).json({ message: "Valid payment amount is required" });
    }

    const result = await createRPOrder({
      amount: Math.round(numericAmount),
      currency: String(currency || "INR").toUpperCase(),
      receipt: String(receipt || `receipt_${Date.now()}`),
    });

    if (result.error) {
      return res.status(500).json({ message: result.error });
    }

    return res.status(200).json({ order: result.order });
  } catch (error) {
    console.error("Create Razorpay Order Error:", error);
    return res.status(500).json({
      message: error.message || "Server error while creating payment order",
    });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: razorpaySignature,
    } = req.body;
    const credentials = getRazorpayCredentials();

    if (credentials.error) {
      return res.status(500).json({ message: credentials.error });
    }

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ message: "Incomplete payment verification data" });
    }

    const expectedSignature = crypto
      .createHmac("sha256", credentials.keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    if (expectedSignature !== razorpaySignature) {
      return res.status(400).json({ message: "Payment signature verification failed" });
    }

    return res.status(200).json({ verified: true });
  } catch (error) {
    console.error("Verify Razorpay Payment Error:", error);
    return res.status(500).json({
      message: error.message || "Server error while verifying payment",
    });
  }
};
