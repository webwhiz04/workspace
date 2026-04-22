import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema(
    {
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        image: {
            type: String,
            default: "",
            trim: true,
        },
        price: {
            type: Number,
            required: true,
            min: 0,
        },
        quantity: {
            type: Number,
            required: true,
            min: 1,
        },
    },
    { _id: false }
);

const orderSchema = new mongoose.Schema(
    {
        items: {
            type: [cartItemSchema],
            default: [],
        },
        itemTotal: {
            type: Number,
            required: true,
            min: 0,
        },
        handlingFee: {
            type: Number,
            required: true,
            min: 0,
        },
        deliveryFee: {
            type: Number,
            required: true,
            min: 0,
        },
        totalAmount: {
            type: Number,
            required: true,
            min: 0,
        },
        orderedAt: {
            type: Date,
            default: Date.now,
        },
        shippingAddress: {
            name: { type: String, default: "" },
            phone: { type: String, default: "" },
            address: { type: String, default: "" },
            city: { type: String, default: "" },
            postalCode: { type: String, default: "" },
            country: { type: String, default: "" }
        },
        paymentDetails: {
            orderId: { type: String, default: "" },
            paymentId: { type: String, default: "" },
            signature: { type: String, default: "" },
            status: { type: String, default: "" },
            method: { type: String, default: "" },
            amount: { type: Number, default: 0 },
            currency: { type: String, default: "INR" },
            paidAt: { type: Date },
        },
        status: {
            type: String,
            default: "Processing"
        }
    },
    { _id: false }
);

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    otp: {
        type: String
    },
    otpExpires: {
        type: Date
    },
    cartItems: {
        type: [cartItemSchema],
        default: [],
    },
    orders: {
        type: [orderSchema],
        default: [],
    },
    savedShippingAddress: {
        name: { type: String, default: "" },
        phone: { type: String, default: "" },
        address: { type: String, default: "" },
        city: { type: String, default: "" },
        postalCode: { type: String, default: "" },
        country: { type: String, default: "" },
    },
    shippingAddresses: {
        type: [
            {
                name: { type: String, default: "" },
                phone: { type: String, default: "" },
                address: { type: String, default: "" },
                city: { type: String, default: "" },
                postalCode: { type: String, default: "" },
                country: { type: String, default: "" },
            },
        ],
        default: [],
    },
});

export default mongoose.model("User", userSchema);