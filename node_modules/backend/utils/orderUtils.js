import mongoose from "mongoose";

export const formatCurrencyInr = (amount) => {
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

export const getCodOrderConfirmationText = ({ email, order }) => {
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

  const shippingLines = [
    shipping.name,
    shipping.phone,
    shipping.address,
    shipping.city,
    shipping.postalCode,
    shipping.country,
  ]
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

export const getOrderConfirmationText = ({ email, order }) => {
  const shipping = order.shippingAddress || {};
  const paidAt = order.paymentDetails?.paidAt
    ? new Date(order.paymentDetails.paidAt)
    : new Date();
  const orderedItems = Array.isArray(order.items) ? order.items : [];
  const itemLines = orderedItems
    .map((item, index) => {
      const quantity = Number(item.quantity || 0);
      const price = Number(item.price || 0);
      return `${index + 1}. ${item.name} x ${quantity} - ${formatCurrencyInr(quantity * price)}`;
    })
    .join("\n");

  const shippingLines = [
    shipping.name,
    shipping.phone,
    shipping.address,
    shipping.city,
    shipping.postalCode,
    shipping.country,
  ]
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

export const normalizeCartItemForOrder = (item = {}) => {
  const rawProductId = item.productId || item._id;
  const productId = rawProductId ? String(rawProductId) : "";
  const name = String(item.name || "").trim();
  const image = String(item.image || "").trim();
  const price = Number(item.price);
  const quantity = Number(item.quantity ?? item.cartQuantity);

  if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
    return null;
  }

  if (
    !name ||
    !Number.isFinite(price) ||
    price < 0 ||
    !Number.isFinite(quantity) ||
    quantity < 1
  ) {
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

export const normalizeShippingAddress = (shippingAddress = {}) => ({
  name: String(shippingAddress.name || "").trim(),
  phone: String(shippingAddress.phone || "").trim(),
  address: String(shippingAddress.address || "").trim(),
  city: String(shippingAddress.city || "").trim(),
  postalCode: String(shippingAddress.postalCode || "").trim(),
  country: String(shippingAddress.country || "").trim(),
});

export const hasMinimumShippingAddress = (shippingAddress = {}) => {
  return Boolean(
    String(shippingAddress.address || "").trim() &&
      String(shippingAddress.city || "").trim() &&
      String(shippingAddress.postalCode || "").trim() &&
      String(shippingAddress.country || "").trim()
  );
};

export const hasCompleteShippingAddress = (shippingAddress = {}) => {
  return Boolean(
    String(shippingAddress.name || "").trim() &&
      String(shippingAddress.phone || "").trim() &&
      hasMinimumShippingAddress(shippingAddress)
  );
};

export const getAddressKey = (shippingAddress = {}) => {
  const normalized = normalizeShippingAddress(shippingAddress);
  return [
    normalized.name,
    normalized.phone,
    normalized.address,
    normalized.city,
    normalized.postalCode,
    normalized.country,
  ]
    .map((part) => part.toLowerCase())
    .join("|");
};

export const getOrderKey = (order = {}) => {
  return String(
    order?.paymentDetails?.paymentId ||
      order?.paymentDetails?.orderId ||
      order?.orderedAt ||
      ""
  ).trim();
};

export const toClientCartItem = (item) => ({
  _id: String(item.productId),
  name: item.name,
  image: item.image,
  price: Number(item.price || 0),
  cartQuantity: Number(item.quantity || 0),
});

export const normalizeCartItemInput = (product = {}) => {
  const rawProductId = product._id || product.id || product.productId;
  const productId = rawProductId ? String(rawProductId) : "";

  return {
    productId,
    name: String(product.name || "").trim(),
    image: String(product.image || "").trim(),
    price: Number(product.price || 0),
  };
};

export const getOrderSnapshotFromCart = (user, handlingFee, deliveryFee) => {
  const rawItems = Array.isArray(user.cartItems) ? user.cartItems : [];

  if (!rawItems.length) {
    return { error: "Cart is empty" };
  }

  const items = rawItems.map(normalizeCartItemForOrder);

  if (items.some((item) => !item)) {
    return {
      error: "Cart has invalid item data. Please update your cart and try again.",
    };
  }

  const itemTotal = items.reduce((total, item) => total + item.price * item.quantity, 0);

  if (!Number.isFinite(itemTotal) || itemTotal < 0) {
    return { error: "Invalid cart total. Please update your cart and try again." };
  }

  const totalAmount = itemTotal + handlingFee + deliveryFee;

  return {
    items,
    itemTotal,
    handlingFee,
    deliveryFee,
    totalAmount,
  };
};
