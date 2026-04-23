import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        price: {
            type: Number,
            required: true,
            min: 0,
        },
        categories: {
            type: [String],
            default: [],
        },

        quantity: {
            type: String,
            required: true,
            trim: true,
        },
        image: {
            type: String,
            default: "",
            trim: true,
        },
        imageOriginalName: {
            type: String,
            default: "",
            trim: true,
        },
        description: {
            type: String,
            default: "",
            trim: true,
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model("Product", productSchema);
