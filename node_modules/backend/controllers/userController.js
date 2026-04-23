import User from "../models/User.js";
import {
  toClientCartItem,
  normalizeCartItemInput,
  normalizeShippingAddress,
  hasMinimumShippingAddress,
  hasCompleteShippingAddress,
  getAddressKey,
} from "../utils/orderUtils.js";
import mongoose from "mongoose";

const isValidEmail = (email) => /\S+@\S+\.\S+/.test(email);

export const getUserByEmail = async (email) => {
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

export const upsertShippingAddress = (user, shippingAddress) => {
  const normalizedAddress = normalizeShippingAddress(shippingAddress);

  if (!hasCompleteShippingAddress(normalizedAddress)) {
    return { error: "Complete shipping address is required" };
  }

  if (!Array.isArray(user.shippingAddresses)) {
    user.shippingAddresses = [];
  }

  const addressKey = getAddressKey(normalizedAddress);
  const existingIndex = user.shippingAddresses.findIndex(
    (address) => getAddressKey(address) === addressKey
  );

  if (existingIndex === -1) {
    user.shippingAddresses.unshift(normalizedAddress);
  } else {
    user.shippingAddresses[existingIndex] = normalizedAddress;
  }

  user.savedShippingAddress = normalizedAddress;
  return {
    shippingAddress: normalizedAddress,
    shippingAddresses: user.shippingAddresses,
  };
};

export const getCart = async (req, res) => {
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
};

export const addToCart = async (req, res) => {
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
};

export const updateCartQuantity = async (req, res) => {
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
};

export const removeFromCart = async (req, res) => {
  req.body.quantity = 0;
  return updateCartQuantity(req, res);
};

export const getShippingAddress = async (req, res) => {
  try {
    const { email } = req.query;
    const result = await getUserByEmail(email);

    if (result.error) {
      return res.status(400).json({ message: result.error });
    }

    const savedShippingAddress = normalizeShippingAddress(
      result.user.savedShippingAddress || {}
    );
    const shippingAddresses = Array.isArray(result.user.shippingAddresses)
      ? result.user.shippingAddresses
          .map(normalizeShippingAddress)
          .filter(hasMinimumShippingAddress)
      : [];

    if (shippingAddresses.length === 0 && hasMinimumShippingAddress(savedShippingAddress)) {
      shippingAddresses.push(savedShippingAddress);
    }

    return res.status(200).json({
      shippingAddress: hasMinimumShippingAddress(savedShippingAddress)
        ? savedShippingAddress
        : null,
      shippingAddresses,
    });
  } catch (error) {
    console.error("Fetch Shipping Address Error:", error);
    return res.status(500).json({ message: "Server error while fetching shipping address" });
  }
};

export const saveShippingAddress = async (req, res) => {
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
};
