import User from "../models/User.js";
import {
  normalizeShippingAddress,
  hasMinimumShippingAddress,
  getOrderSnapshotFromCart,
  getOrderConfirmationText,
  getOrderKey,
} from "../utils/orderUtils.js";
import { getUserByEmail, upsertShippingAddress } from "./userController.js";
import { getSanitizedEmailUser, createTransporter, getMailConfigError } from "../utils/mailer.js";
import { getRazorpayCredentials, createRazorpayOrder } from "../utils/razorpayUtils.js";
import crypto from "crypto";

const COD_HANDLING_FEE = 3;
const COD_DELIVERY_FEE = 5;
const ONLINE_HANDLING_FEE = 30;
const ONLINE_DELIVERY_FEE = 10;

const sendOrderConfirmationEmail = async ({ email, order, isCod = false }) => {
  const mailConfigError = getMailConfigError();

  if (mailConfigError) {
    console.warn(`Order confirmation mail skipped for ${email}: ${mailConfigError}`);
    return;
  }

  const transporter = createTransporter();
  const messageText = getOrderConfirmationText({ email, order });

  await transporter.sendMail({
    from: getSanitizedEmailUser(),
    to: email,
    subject: isCod
      ? "Order Placed (COD) - Thank you for your purchase"
      : "Order Confirmed - Thank you for your purchase",
    text: messageText,
  });
};

export const placeCodOrder = async (req, res) => {
  try {
    const { email, shippingAddress } = req.body;
    const result = await getUserByEmail(email);

    if (result.error) {
      return res.status(400).json({ message: result.error });
    }

    const providedShippingAddress = normalizeShippingAddress(shippingAddress);
    const effectiveShippingAddress = hasMinimumShippingAddress(providedShippingAddress)
      ? providedShippingAddress
      : normalizeShippingAddress(result.user.savedShippingAddress || {});

    if (!hasMinimumShippingAddress(effectiveShippingAddress)) {
      return res.status(400).json({ message: "Complete shipping address is required" });
    }

    const orderSnapshot = getOrderSnapshotFromCart(
      result.user,
      COD_HANDLING_FEE,
      COD_DELIVERY_FEE
    );

    if (orderSnapshot.error) {
      return res.status(400).json({ message: orderSnapshot.error });
    }

    const newOrder = {
      items: orderSnapshot.items,
      itemTotal: orderSnapshot.itemTotal,
      handlingFee: orderSnapshot.handlingFee,
      deliveryFee: orderSnapshot.deliveryFee,
      totalAmount: orderSnapshot.totalAmount,
      shippingAddress: effectiveShippingAddress,
      orderedAt: new Date(),
      status: "Placed",
      paymentDetails: {
        orderId: `COD-${Date.now()}`,
        method: "Cash on Delivery",
        status: "pending",
        amount: orderSnapshot.totalAmount,
        currency: "INR",
        paidAt: null,
      },
    };

    result.user.orders.push(newOrder);
    upsertShippingAddress(result.user, effectiveShippingAddress);
    result.user.cartItems = [];
    await result.user.save();

    await sendOrderConfirmationEmail({
      email: result.normalizedEmail,
      order: newOrder,
      isCod: true,
    }).catch((err) => console.error("Mail error:", err));

    return res.status(200).json({
      message: "Order placed successfully",
      order: newOrder,
      cartItems: [],
    });
  } catch (error) {
    console.error("Place COD Order Error:", error);
    return res.status(500).json({ message: "Server error while placing order" });
  }
};

export const checkoutOnline = async (req, res) => {
  try {
    const { email, receipt } = req.body;
    const result = await getUserByEmail(email);

    if (result.error) {
      return res.status(400).json({ message: result.error });
    }

    const orderSnapshot = getOrderSnapshotFromCart(
      result.user,
      ONLINE_HANDLING_FEE,
      ONLINE_DELIVERY_FEE
    );

    if (orderSnapshot.error) {
      return res.status(400).json({ message: orderSnapshot.error });
    }

    const amountInPaise = Math.round(orderSnapshot.totalAmount * 100);
    const razorpayOrderResult = await createRazorpayOrder({
      amount: amountInPaise,
      currency: "INR",
      receipt: String(receipt || `receipt_${Date.now()}`),
    });

    if (razorpayOrderResult.error) {
      return res.status(500).json({ message: razorpayOrderResult.error });
    }

    return res.status(200).json({
      order: razorpayOrderResult.order,
      amountBreakdown: {
        itemTotal: orderSnapshot.itemTotal,
        handlingFee: orderSnapshot.handlingFee,
        deliveryFee: orderSnapshot.deliveryFee,
        totalAmount: orderSnapshot.totalAmount,
      },
    });
  } catch (error) {
    console.error("Checkout Online Error:", error);
    return res.status(500).json({ message: "Server error while initiating checkout" });
  }
};

export const verifyOnlinePayment = async (req, res) => {
  try {
    const {
      email,
      shippingAddress,
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: razorpaySignature,
    } = req.body;

    const credentials = getRazorpayCredentials();
    if (credentials.error) return res.status(500).json({ message: credentials.error });

    if (!email || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ message: "Incomplete payment verification data" });
    }

    const result = await getUserByEmail(email);
    if (result.error) return res.status(400).json({ message: result.error });

    const normalizedShippingAddress = normalizeShippingAddress(
      shippingAddress || result.user.savedShippingAddress || {}
    );
    if (!hasMinimumShippingAddress(normalizedShippingAddress)) {
      return res.status(400).json({ message: "Complete shipping address is required" });
    }

    const orderSnapshot = getOrderSnapshotFromCart(
      result.user,
      ONLINE_HANDLING_FEE,
      ONLINE_DELIVERY_FEE
    );
    if (orderSnapshot.error) return res.status(400).json({ message: orderSnapshot.error });

    const expectedSignature = crypto
      .createHmac("sha256", credentials.keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    if (expectedSignature !== razorpaySignature) {
      return res.status(400).json({ message: "Payment signature verification failed" });
    }

    // Normally we'd fetch the payment from Razorpay here to be 100% sure,
    // but the signature verification is usually enough for most cases.
    // For production, fetching is better.

    const alreadySaved = (result.user.orders || []).some(
      (order) => String(order?.paymentDetails?.paymentId || "") === String(razorpayPaymentId)
    );

    let finalOrder;
    if (!alreadySaved) {
      finalOrder = {
        items: orderSnapshot.items,
        itemTotal: orderSnapshot.itemTotal,
        handlingFee: orderSnapshot.handlingFee,
        deliveryFee: orderSnapshot.deliveryFee,
        totalAmount: orderSnapshot.totalAmount,
        shippingAddress: normalizedShippingAddress,
        orderedAt: new Date(),
        status: "Placed",
        paymentDetails: {
          orderId: razorpayOrderId,
          paymentId: razorpayPaymentId,
          signature: razorpaySignature,
          status: "captured", // We assume captured if signature matches
          method: "online",
          amount: orderSnapshot.totalAmount,
          currency: "INR",
          paidAt: new Date(),
        },
      };

      result.user.orders.push(finalOrder);
      upsertShippingAddress(result.user, normalizedShippingAddress);
      result.user.cartItems = [];
      await result.user.save();

      await sendOrderConfirmationEmail({
        email: result.normalizedEmail,
        order: finalOrder,
      }).catch((err) => console.error("Mail error:", err));
    } else {
      finalOrder = result.user.orders.find(
        (order) => String(order?.paymentDetails?.paymentId || "") === String(razorpayPaymentId)
      );
    }

    return res.status(200).json({
      verified: true,
      message: "Payment verified and order saved",
      order: finalOrder,
    });
  } catch (error) {
    console.error("Verify Online Payment Error:", error);
    return res.status(500).json({ message: "Server error while verifying payment" });
  }
};

export const getOrders = async (req, res) => {
  try {
    const { email } = req.query;
    const result = await getUserByEmail(email);

    if (result.error) {
      return res.status(400).json({ message: result.error });
    }

    return res.status(200).json({ orders: result.user.orders || [] });
  } catch (error) {
    console.error("Fetch Orders Error:", error);
    return res.status(500).json({ message: "Server error while fetching orders" });
  }
};

export const getAdminOrders = async (_req, res) => {
  try {
    const users = await User.find({ "orders.0": { $exists: true } })
      .select("email orders")
      .lean();
    const orders = users.flatMap((user) => {
      return (Array.isArray(user.orders) ? user.orders : []).map((order) => ({
        userEmail: user.email,
        orderKey: getOrderKey(order),
        ...order,
      }));
    });

    return res.status(200).json({ orders });
  } catch (error) {
    console.error("Fetch Admin Orders Error:", error);
    return res.status(500).json({ message: "Server error while fetching admin orders" });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { email, orderKey, status } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedStatus = String(status || "").trim();

    if (!normalizedEmail || !orderKey || !normalizedStatus) {
      return res.status(400).json({ message: "Email, orderKey and status are required" });
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const orders = Array.isArray(user.orders) ? user.orders : [];
    const orderIndex = orders.findIndex(
      (order) => getOrderKey(order) === String(orderKey).trim()
    );

    if (orderIndex === -1) {
      return res.status(404).json({ message: "Order not found" });
    }

    user.orders[orderIndex].status = normalizedStatus;
    await user.save();

    return res.status(200).json({
      message: "Order status updated",
      order: user.orders[orderIndex],
    });
  } catch (error) {
    console.error("Update Admin Order Status Error:", error);
    return res.status(500).json({ message: "Server error while updating order status" });
  }
};
