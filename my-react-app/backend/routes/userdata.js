import express from "express";
import crypto from "crypto";
import mongoose from "mongoose";
import nodemailer from "nodemailer";
import User from "../user.js";

const router = express.Router();

const HANDLING_FEE = 3;
const DELIVERY_FEE = 5;
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

const getCodOrderConfirmationText = ({ email, order }) => {
    const shipping = order.shippingAddress || {};
    const orderedAt = order.orderedAt ? new Date(order.orderedAt) : new Date();
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
        "Your Cash on Delivery order has been placed successfully.",
        "",
        `Order ID: ${order.paymentDetails?.orderId || "N/A"}`,
        `Order Date: ${orderedAt.toLocaleString("en-IN")}`,
        `Payment Method: ${order.paymentDetails?.method || "Cash on Delivery"}`,
        `Payment Status: ${order.paymentDetails?.status || "pending"}`,
        "",
        "Items:",
        itemLines || "No items available",
        "",
        `Item Total: ${formatCurrencyInr(order.itemTotal)}`,
        `Handling Fee: ${formatCurrencyInr(order.handlingFee)}`,
        `Delivery Fee: ${formatCurrencyInr(order.deliveryFee)}`,
        `Amount Payable: ${formatCurrencyInr(order.totalAmount)}`,
        "",
        `Shipping Address: ${shippingLines || "N/A"}`,
        "",
        "Please keep cash ready at the time of delivery.",
        "",
        `Account Email: ${email}`,
    ].join("\n");
};

const sendCodOrderConfirmationEmail = async ({ email, order }) => {
    const mailConfigError = getMailConfigError();

    if (mailConfigError) {
        console.warn(`COD order confirmation mail skipped for ${email}: ${mailConfigError}`);
        return;
    }

    const transporter = createTransporter();
    const messageText = getCodOrderConfirmationText({ email, order });

    await transporter.sendMail({
        from: getSanitizedEmailUser(),
        to: email,
        subject: "Order Placed (COD) - Thank you for your purchase",
        text: messageText,
    });
};

const toClientCartItem = (item) => ({
    _id: String(item.productId),
    name: item.name,
    image: item.image,
    price: Number(item.price || 0),
    cartQuantity: Number(item.quantity || 0),
});

const normalizeCartItemInput = (product = {}) => {
    const rawProductId = product._id || product.id || product.productId;
    const productId = rawProductId ? String(rawProductId) : "";

    return {
        productId,
        name: String(product.name || "").trim(),
        image: String(product.image || "").trim(),
        price: Number(product.price || 0),
    };
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

const normalizeShippingAddress = (shippingAddress = {}) => ({
    name: String(shippingAddress.name || "").trim(),
    phone: String(shippingAddress.phone || "").trim(),
    address: String(shippingAddress.address || "").trim(),
    city: String(shippingAddress.city || "").trim(),
    postalCode: String(shippingAddress.postalCode || "").trim(),
    country: String(shippingAddress.country || "").trim(),
});

const hasMinimumShippingAddress = (shippingAddress = {}) => {
    return Boolean(
        String(shippingAddress.address || "").trim() &&
        String(shippingAddress.city || "").trim() &&
        String(shippingAddress.postalCode || "").trim() &&
        String(shippingAddress.country || "").trim()
    );
};

const hasCompleteShippingAddress = (shippingAddress = {}) => {
    return Boolean(
        String(shippingAddress.name || "").trim() &&
        String(shippingAddress.phone || "").trim() &&
        hasMinimumShippingAddress(shippingAddress)
    );
};

const getAddressKey = (shippingAddress = {}) => {
    const normalized = normalizeShippingAddress(shippingAddress);
    return [normalized.name, normalized.phone, normalized.address, normalized.city, normalized.postalCode, normalized.country]
        .map((part) => part.toLowerCase())
        .join("|");
};

const getOrderKey = (order = {}) => {
    return String(
        order?.paymentDetails?.paymentId
        || order?.paymentDetails?.orderId
        || order?.orderedAt
        || ""
    ).trim();
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

const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";

const getRazorpayCredentials = () => {
    const keyId = String(process.env.RAZORPAY_KEY_ID || "").trim();
    const keySecret = String(process.env.RAZORPAY_KEY_SECRET || "").trim();

    if (!keyId || !keySecret) {
        return { error: "Razorpay credentials are not configured" };
    }

    return { keyId, keySecret };
};

const createRazorpayAuthHeader = (keyId, keySecret) => {
    return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
};

const readRazorpayResponse = async (response) => {
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        const errorMessage = data?.error?.description || data?.error?.reason || data?.error?.message || "Unable to process Razorpay request";
        throw new Error(errorMessage);
    }

    return data;
};

const createRazorpayOrder = async ({ amount, currency = "INR", receipt }) => {
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

router.get("/cart", async (req, res) => {
    try {
        const { email } = req.query;
        const result = await getUserByEmail(email);

        if (result.error) {
            return res.status(400).json({ message: result.error });
        }

        const cartItems = result.user.cartItems.map(toClientCartItem);
        return res.status(200).json({ cartItems });
    } catch (error) {
        console.error("Fetch Cart Error:", error);
        return res.status(500).json({ message: "Server error while fetching cart" });
    }
});

router.get("/payment/config", async (_req, res) => {
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

router.post("/cart/add", async (req, res) => {
    try {
        const { email, product } = req.body;
        const result = await getUserByEmail(email);

        if (result.error) {
            return res.status(400).json({ message: result.error });
        }

        const normalized = normalizeCartItemInput(product);

        if (!normalized.productId || !mongoose.Types.ObjectId.isValid(normalized.productId)) {
            return res.status(400).json({ message: "Valid product is required" });
        }

        if (!normalized.name || normalized.price < 0) {
            return res.status(400).json({ message: "Invalid product details" });
        }

        const existingIndex = result.user.cartItems.findIndex(
            (item) => String(item.productId) === String(normalized.productId)
        );

        if (existingIndex === -1) {
            result.user.cartItems.push({ ...normalized, quantity: 1 });
        } else {
            result.user.cartItems[existingIndex].quantity += 1;
        }

        await result.user.save();

        return res.status(200).json({
            message: "Added to cart",
            cartItems: result.user.cartItems.map(toClientCartItem),
        });
    } catch (error) {
        console.error("Add Cart Item Error:", error);
        return res.status(500).json({ message: "Server error while adding to cart" });
    }
});

router.patch("/cart/item", async (req, res) => {
    try {
        const { email, productId, quantity } = req.body;
        const result = await getUserByEmail(email);

        if (result.error) {
            return res.status(400).json({ message: result.error });
        }

        const nextQuantity = Number(quantity || 0);

        if (!productId || !mongoose.Types.ObjectId.isValid(String(productId))) {
            return res.status(400).json({ message: "Valid productId is required" });
        }

        if (!Number.isFinite(nextQuantity) || nextQuantity < 0) {
            return res.status(400).json({ message: "Quantity must be 0 or greater" });
        }

        result.user.cartItems = result.user.cartItems
            .map((item) => {
                if (String(item.productId) !== String(productId)) {
                    return item;
                }

                if (nextQuantity === 0) {
                    return null;
                }

                item.quantity = nextQuantity;
                return item;
            })
            .filter(Boolean);

        await result.user.save();

        return res.status(200).json({
            message: "Cart updated",
            cartItems: result.user.cartItems.map(toClientCartItem),
        });
    } catch (error) {
        console.error("Update Cart Item Error:", error);
        return res.status(500).json({ message: "Server error while updating cart" });
    }
});

router.post("/orders/place", async (req, res) => {
    try {
        const { email, shippingAddress } = req.body;
        const result = await getUserByEmail(email);

        if (result.error) {
            return res.status(400).json({ message: result.error });
        }

        const providedShippingAddress = normalizeShippingAddress(shippingAddress);
        const storedAddresses = Array.isArray(result.user.shippingAddresses)
            ? result.user.shippingAddresses.map(normalizeShippingAddress).filter(hasMinimumShippingAddress)
            : [];
        const fallbackSavedAddress = normalizeShippingAddress(result.user.savedShippingAddress || {});
        const effectiveShippingAddress = hasMinimumShippingAddress(providedShippingAddress)
            ? providedShippingAddress
            : (storedAddresses[0] || fallbackSavedAddress);

        if (!hasMinimumShippingAddress(effectiveShippingAddress)) {
            return res.status(400).json({ message: "Complete shipping address is required" });
        }

        const rawItems = Array.isArray(result.user.cartItems) ? result.user.cartItems : [];
        const items = rawItems.map(normalizeCartItemForOrder);

        if (!rawItems.length) {
            return res.status(400).json({ message: "Cart is empty" });
        }

        if (items.some((item) => !item)) {
            return res.status(400).json({
                message: "Cart has invalid item data. Please update your cart and try again.",
            });
        }

        const itemTotal = items.reduce((total, item) => total + item.price * item.quantity, 0);

        if (!Number.isFinite(itemTotal) || itemTotal < 0) {
            return res.status(400).json({ message: "Invalid cart total. Please update your cart and try again." });
        }

        const handlingFee = HANDLING_FEE;
        const deliveryFee = DELIVERY_FEE;
        const totalAmount = itemTotal + handlingFee + deliveryFee;

        const newOrder = {
            items,
            itemTotal,
            handlingFee,
            deliveryFee,
            totalAmount,
            shippingAddress: effectiveShippingAddress,
            orderedAt: new Date(),
            status: "Placed",
            paymentDetails: {
                orderId: `COD-${Date.now()}`,
                method: "Cash on Delivery",
                status: "pending",
                amount: totalAmount,
                currency: "INR",
                paidAt: null,
            },
        };

        result.user.orders.push(newOrder);
        upsertShippingAddress(result.user, effectiveShippingAddress);
        result.user.cartItems = [];
        await result.user.save();

        try {
            await sendCodOrderConfirmationEmail({
                email: result.normalizedEmail,
                order: newOrder,
            });
        } catch (mailError) {
            console.error("COD order confirmation mail error:", mailError.message || mailError);
        }

        return res.status(200).json({
            message: "Order placed successfully",
            order: newOrder,
            cartItems: [],
        });
    } catch (error) {
        console.error("Place Order Error:", error);
        return res.status(500).json({ message: "Server error while placing order" });
    }
});

router.post("/payment/order", async (req, res) => {
    try {
        const { amount, currency, receipt } = req.body;
        const numericAmount = Number(amount || 0);

        if (!Number.isFinite(numericAmount) || numericAmount < 1) {
            return res.status(400).json({ message: "Valid payment amount is required" });
        }

        const result = await createRazorpayOrder({
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
        return res.status(500).json({ message: error.message || "Server error while creating payment order" });
    }
});

router.post("/payment/verify", async (req, res) => {
    try {
        const { razorpay_order_id: razorpayOrderId, razorpay_payment_id: razorpayPaymentId, razorpay_signature: razorpaySignature } = req.body;
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
        return res.status(500).json({ message: error.message || "Server error while verifying payment" });
    }
});

router.get("/shipping-address", async (req, res) => {
    try {
        const { email } = req.query;
        const result = await getUserByEmail(email);

        if (result.error) {
            return res.status(400).json({ message: result.error });
        }

        const savedShippingAddress = normalizeShippingAddress(result.user.savedShippingAddress || {});
        const shippingAddresses = Array.isArray(result.user.shippingAddresses)
            ? result.user.shippingAddresses
                .map(normalizeShippingAddress)
                .filter(hasMinimumShippingAddress)
            : [];

        if (shippingAddresses.length === 0 && hasMinimumShippingAddress(savedShippingAddress)) {
            shippingAddresses.push(savedShippingAddress);
        }

        return res.status(200).json({
            shippingAddress: hasMinimumShippingAddress(savedShippingAddress) ? savedShippingAddress : null,
            shippingAddresses,
        });
    } catch (error) {
        console.error("Fetch Shipping Address Error:", error);
        return res.status(500).json({ message: "Server error while fetching shipping address" });
    }
});

router.post("/shipping-address", async (req, res) => {
    try {
        const { email, shippingAddress } = req.body;
        const result = await getUserByEmail(email);

        if (result.error) {
            return res.status(400).json({ message: result.error });
        }

        const updated = upsertShippingAddress(result.user, shippingAddress);

        if (updated.error) {
            return res.status(400).json({ message: updated.error });
        }

        await result.user.save();

        return res.status(200).json({
            message: "Shipping address saved successfully",
            shippingAddress: updated.shippingAddress,
            shippingAddresses: updated.shippingAddresses,
        });
    } catch (error) {
        console.error("Save Shipping Address Error:", error);
        return res.status(500).json({ message: "Server error while saving shipping address" });
    }
});

router.get("/orders", async (req, res) => {
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
});

router.get("/admin/orders", async (_req, res) => {
    try {
        const users = await User.find({ "orders.0": { $exists: true } }).select("email orders").lean();
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
});

router.patch("/admin/orders/status", async (req, res) => {
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
        const orderIndex = orders.findIndex((order) => getOrderKey(order) === String(orderKey).trim());

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
});

export default router;
