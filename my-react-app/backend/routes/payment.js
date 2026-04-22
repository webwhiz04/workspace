import express from "express";
import crypto from "crypto";
import mongoose from "mongoose";
import Razorpay from "razorpay";
import nodemailer from "nodemailer";
import User from "../user.js";

const router = express.Router();

const HANDLING_FEE = 30;
const DELIVERY_FEE = 10;
const PLACEHOLDER_VALUES = ["yourgmail@gmail.com", "your_app_password"];
const GMAIL_APP_PASSWORD_REGEX = /^[a-zA-Z0-9]{16}$/;

const isValidEmail = (email) => /\S+@\S+\.\S+/.test(email);

const getSanitizedEmailUser = () => process.env.EMAIL_USER?.trim();
const getSanitizedEmailPass = () => process.env.EMAIL_PASS?.replace(/\s+/g, "").trim();

const getMailConfigError = () => {
	const emailUser = getSanitizedEmailUser();
	const emailPass = getSanitizedEmailPass();

	if (!emailUser || !emailPass) {
		return "EMAIL_USER and EMAIL_PASS must be set in backend/.env";
	}

	if (PLACEHOLDER_VALUES.includes(emailUser) || PLACEHOLDER_VALUES.includes(emailPass)) {
		return "Replace placeholder Gmail credentials in backend/.env";
	}

	if (emailUser.endsWith("@gmail.com") && !GMAIL_APP_PASSWORD_REGEX.test(emailPass)) {
		return "For Gmail, EMAIL_PASS must be a 16-character App Password.";
	}

	return null;
};

const createTransporter = () => {
	return nodemailer.createTransport({
		service: "gmail",
		auth: {
			user: getSanitizedEmailUser(),
			pass: getSanitizedEmailPass(),
		},
	});
};

const formatCurrencyInr = (amount) => {
	const value = Number(amount);

	if (!Number.isFinite(value)) {
		return "INR 0.00";
	}

	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		maximumFractionDigits: 2,
	}).format(value);
};

const getOrderConfirmationText = ({ email, order }) => {
	const shipping = order.shippingAddress || {};
	const paidAt = order.paymentDetails?.paidAt ? new Date(order.paymentDetails.paidAt) : new Date();
	const orderedItems = Array.isArray(order.items) ? order.items : [];
	const itemLines = orderedItems
		.map((item, index) => {
			const quantity = Number(item.quantity || 0);
			const price = Number(item.price || 0);
			return `${index + 1}. ${item.name} x ${quantity} - ${formatCurrencyInr(quantity * price)}`;
		})
		.join("\n");

	const shippingLines = [shipping.name, shipping.phone, shipping.address, shipping.city, shipping.postalCode, shipping.country]
		.filter(Boolean)
		.join(", ");

	return [
		"Hello,",
		"",
		"Your order has been confirmed successfully.",
		"",
		`Payment ID: ${order.paymentDetails?.paymentId || "N/A"}`,
		`Order ID: ${order.paymentDetails?.orderId || "N/A"}`,
		`Paid At: ${paidAt.toLocaleString("en-IN")}`,
		"",
		"Items:",
		itemLines || "No items available",
		"",
		`Item Total: ${formatCurrencyInr(order.itemTotal)}`,
		`Handling Fee: ${formatCurrencyInr(order.handlingFee)}`,
		`Delivery Fee: ${formatCurrencyInr(order.deliveryFee)}`,
		`Total Paid: ${formatCurrencyInr(order.totalAmount)}`,
		"",
		`Shipping Address: ${shippingLines || "N/A"}`,
		"",
		"Thank you for shopping with us.",
		"",
		`Account Email: ${email}`,
	].join("\n");
};

const sendOrderConfirmationEmail = async ({ email, order }) => {
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
		subject: "Order Confirmed - Thank you for your purchase",
		text: messageText,
	});
};

const normalizeShippingAddress = (shippingAddress = {}) => ({
	name: String(shippingAddress.name || "").trim(),
	phone: String(shippingAddress.phone || "").trim(),
	address: String(shippingAddress.address || "").trim(),
	city: String(shippingAddress.city || "").trim(),
	postalCode: String(shippingAddress.postalCode || "").trim(),
	country: String(shippingAddress.country || "").trim(),
});

const hasMinimumShippingAddress = (shippingAddress = {}) => {
	return ["address", "city", "postalCode", "country"].every((field) => {
		return Boolean(String(shippingAddress[field] || "").trim());
	});
};

const hasCompleteShippingAddress = (shippingAddress = {}) => {
	return Boolean(
		String(shippingAddress.name || "").trim()
		&& String(shippingAddress.phone || "").trim()
		&& hasMinimumShippingAddress(shippingAddress)
	);
};

const getAddressKey = (shippingAddress = {}) => {
	const normalized = normalizeShippingAddress(shippingAddress);
	return [normalized.name, normalized.phone, normalized.address, normalized.city, normalized.postalCode, normalized.country]
		.map((part) => part.toLowerCase())
		.join("|");
};

const upsertShippingAddress = (user, shippingAddress) => {
	const normalizedAddress = normalizeShippingAddress(shippingAddress);

	if (!hasCompleteShippingAddress(normalizedAddress)) {
		return { error: "Complete shipping address is required" };
	}

	if (!Array.isArray(user.shippingAddresses)) {
		user.shippingAddresses = [];
	}

	const addressKey = getAddressKey(normalizedAddress);
	const existingIndex = user.shippingAddresses.findIndex((address) => getAddressKey(address) === addressKey);

	if (existingIndex === -1) {
		user.shippingAddresses.unshift(normalizedAddress);
	} else {
		user.shippingAddresses[existingIndex] = normalizedAddress;
	}

	user.savedShippingAddress = normalizedAddress;
	return { shippingAddress: normalizedAddress, shippingAddresses: user.shippingAddresses };
};

const normalizeCartItemForOrder = (item = {}) => {
	const rawProductId = item.productId || item._id;
	const productId = rawProductId ? String(rawProductId) : "";
	const name = String(item.name || "").trim();
	const image = String(item.image || "").trim();
	const price = Number(item.price);
	const quantity = Number(item.quantity ?? item.cartQuantity);

	if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
		return null;
	}

	if (!name || !Number.isFinite(price) || price < 0 || !Number.isFinite(quantity) || quantity < 1) {
		return null;
	}

	return {
		productId,
		name,
		image,
		price,
		quantity,
	};
};

const getUserByEmail = async (email) => {
	const normalizedEmail = String(email || "").trim().toLowerCase();

	if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
		return { error: "Valid email is required" };
	}

	const user = await User.findOne({ email: normalizedEmail });

	if (!user) {
		return { error: "User not found" };
	}

	return { user, normalizedEmail };
};

const getRazorpayCredentials = () => {
	const keyId = String(process.env.RAZORPAY_KEY_ID || "").trim();
	const keySecret = String(process.env.RAZORPAY_KEY_SECRET || "").trim();

	if (!keyId || !keySecret) {
		return { error: "Razorpay credentials are not configured" };
	}

	return { keyId, keySecret };
};

const getRazorpayClient = () => {
	const credentials = getRazorpayCredentials();

	if (credentials.error) {
		return { error: credentials.error };
	}

	return {
		client: new Razorpay({
			key_id: credentials.keyId,
			key_secret: credentials.keySecret,
		}),
	};
};

const createRazorpayOrder = async ({ amount, currency = "INR", receipt }) => {
	const razorpayClient = getRazorpayClient();

	if (razorpayClient.error) {
		return { error: razorpayClient.error };
	}

	const order = await razorpayClient.client.orders.create({
		amount,
		currency,
		receipt,
		payment_capture: 1,
	});

	return { order };
};

const fetchRazorpayPayment = async (paymentId) => {
	const razorpayClient = getRazorpayClient();

	if (razorpayClient.error) {
		return { error: razorpayClient.error };
	}

	const payment = await razorpayClient.client.payments.fetch(paymentId);
	return { payment };
};

const getOrderSnapshotFromCart = (user) => {
	const rawItems = Array.isArray(user.cartItems) ? user.cartItems : [];

	if (!rawItems.length) {
		return { error: "Cart is empty" };
	}

	const items = rawItems.map(normalizeCartItemForOrder);

	if (items.some((item) => !item)) {
		return { error: "Cart has invalid item data. Please update your cart and try again." };
	}

	const itemTotal = items.reduce((total, item) => total + item.price * item.quantity, 0);

	if (!Number.isFinite(itemTotal) || itemTotal < 0) {
		return { error: "Invalid cart total. Please update your cart and try again." };
	}

	const handlingFee = HANDLING_FEE;
	const deliveryFee = DELIVERY_FEE;
	const totalAmount = itemTotal + handlingFee + deliveryFee;

	return {
		items,
		itemTotal,
		handlingFee,
		deliveryFee,
		totalAmount,
	};
};

router.get("/config", async (_req, res) => {
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
});

router.post("/checkout", async (req, res) => {
	try {
		const { email, receipt } = req.body;
		const result = await getUserByEmail(email);

		if (result.error) {
			return res.status(400).json({ message: result.error });
		}

		const orderSnapshot = getOrderSnapshotFromCart(result.user);

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
		console.error("Create Checkout Error:", error);
		return res.status(500).json({ message: error.message || "Server error while initiating checkout" });
	}
});

router.post("/verify-payment", async (req, res) => {
	try {
		const {
			email,
			shippingAddress,
			razorpay_order_id: razorpayOrderId,
			razorpay_payment_id: razorpayPaymentId,
			razorpay_signature: razorpaySignature,
		} = req.body;

		const credentials = getRazorpayCredentials();

		if (credentials.error) {
			return res.status(500).json({ message: credentials.error });
		}

		if (!email || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
			return res.status(400).json({ message: "Incomplete payment verification data" });
		}

		const result = await getUserByEmail(email);

		if (result.error) {
			return res.status(400).json({ message: result.error });
		}

		const normalizedShippingAddress = normalizeShippingAddress(shippingAddress || result.user.savedShippingAddress || {});

		if (!hasMinimumShippingAddress(normalizedShippingAddress)) {
			return res.status(400).json({ message: "Complete shipping address is required" });
		}

		const orderSnapshot = getOrderSnapshotFromCart(result.user);

		if (orderSnapshot.error) {
			return res.status(400).json({ message: orderSnapshot.error });
		}

		const expectedSignature = crypto
			.createHmac("sha256", credentials.keySecret)
			.update(`${razorpayOrderId}|${razorpayPaymentId}`)
			.digest("hex");

		if (expectedSignature !== razorpaySignature) {
			return res.status(400).json({ message: "Payment signature verification failed" });
		}

		const paymentResult = await fetchRazorpayPayment(razorpayPaymentId);

		if (paymentResult.error) {
			return res.status(500).json({ message: paymentResult.error });
		}

		const payment = paymentResult.payment;
		const expectedAmountInPaise = Math.round(orderSnapshot.totalAmount * 100);

		if (payment.order_id !== razorpayOrderId) {
			return res.status(400).json({ message: "Payment order mismatch" });
		}

		if (Number(payment.amount || 0) !== expectedAmountInPaise) {
			return res.status(400).json({ message: "Payment amount mismatch" });
		}

		if (!(payment.status === "captured" || payment.status === "authorized")) {
			return res.status(400).json({ message: "Payment is not captured" });
		}

		const alreadySaved = (result.user.orders || []).some(
			(order) => String(order?.paymentDetails?.paymentId || "") === String(razorpayPaymentId)
		);

		if (!alreadySaved) {
			const newOrder = {
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
					status: payment.status,
					method: String(payment.method || ""),
					amount: Number(payment.amount || 0) / 100,
					currency: String(payment.currency || "INR"),
					paidAt: payment.captured_at ? new Date(Number(payment.captured_at) * 1000) : new Date(),
				},
			};

			result.user.orders.push(newOrder);
			upsertShippingAddress(result.user, normalizedShippingAddress);
			result.user.cartItems = [];
			await result.user.save();

			try {
				await sendOrderConfirmationEmail({
					email: result.normalizedEmail,
					order: newOrder,
				});
			} catch (mailError) {
				console.error("Order confirmation mail error:", mailError.message || mailError);
			}
		}

		const orderToReturn = alreadySaved
			? (result.user.orders || []).find((order) => String(order?.paymentDetails?.paymentId || "") === String(razorpayPaymentId)) || null
			: result.user.orders[result.user.orders.length - 1] || null;

		return res.status(200).json({
			verified: true,
			message: "Payment verified and order saved",
			order: orderToReturn,
		});
	} catch (error) {
		console.error("Verify and Save Payment Error:", error);
		return res.status(500).json({ message: error.message || "Server error while verifying payment" });
	}
});

export default router;