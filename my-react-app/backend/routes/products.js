import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Product from "../product.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.resolve(__dirname, "..", "uploads");

const resolveImagePath = (imagePath) => path.resolve(UPLOADS_DIR, String(imagePath || "").replace(/^\/+/, ""));

const storage = multer.diskStorage({
    destination: (_req, _file, callback) => {
        callback(null, UPLOADS_DIR);
    },
    filename:function (_req, file, callback) {
        callback(null,Date.now()+"-"+file.originalname);
    },
});

const upload = multer({
    storage,
    fileFilter: (_req, file, callback) => {
        if (file.mimetype?.startsWith("image/")) {
            callback(null, true);
            return;
        }

        callback(new Error("Only image files are allowed"));
    },
});

const CATEGORIES = new Set([
    "cafe",
    "home",
    "toys",
    "fresh",
    "electronics",
    "mobile",
    "beauty",
    "fashion",
]);

const normalizeCategories = (input, fallback = []) => {
    let raw = input;

    if (typeof raw === "string") {
        try {
            raw = JSON.parse(raw);
        } catch {
            raw = [raw];
        }
    }

    if (!Array.isArray(raw)) {
        return fallback;
    }

    return raw
        .map((item) => {
            if (typeof item === "string") return item.trim().toLowerCase();
            if (item && typeof item === "object" && typeof item.value === "string") {
                return item.value.trim().toLowerCase();
            }
            return "";
        })
        .filter((value) => value && CATEGORIES.has(value));
};

const normalizeQuantity = (value) => {
    if (value === undefined || value === null) return "";
    return String(value).trim();
};

router.post("/", upload.single("image"), async (req, res) => {
    try {
        const { name, price, categories, quantity, description } = req.body;
        const normalizedQuantity = normalizeQuantity(quantity);

        if (!name || !price || !normalizedQuantity) {
            return res.status(400).json({ message: "Name, price and quantity are required" });
        }

        const parsedCategories = normalizeCategories(categories, []);

        if (parsedCategories.length === 0) {
            return res.status(400).json({ message: "At least one valid category is required" });
        }

        const product = await Product.create({
            name,
            price,
            categories: parsedCategories,
            quantity: normalizedQuantity,
            image: req.file ? `uploads/${req.file.filename}` : "",
            description: description || "",
        });

        return res.status(201).json({
            message: "Product saved successfully",
            product,
        });
    } catch (error) {
        console.error("Create Product Error:", error);
        return res.status(500).json({ message: "Server error while saving product" });
    }
});

router.get(["", "/"], async (req, res) => {
    try {
        const category = typeof req.query.category === "string"
            ? req.query.category.trim().toLowerCase()
            : "";

        const filter = {};

        if (category && category !== "all") {
            if (!CATEGORIES.has(category)) {
                return res.status(400).json({ message: "Invalid category" });
            }

            filter.categories = category;
        }

        const products = await Product.find(filter);
        return res.status(200).json({ products });
    } catch (error) {
        console.error("Fetch Products Error:", error);
        return res.status(500).json({ message: "Server error while fetching products" });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const product = await Product.findById(id);

        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        return res.status(200).json({ product });
    } catch (error) {
        console.error("Fetch Product By Id Error:", error);
        return res.status(500).json({ message: "Server error while fetching product" });
    }
});

router.put("/:id", upload.single("image"), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, categories, quantity, description } = req.body;
        const product = await Product.findById(id);

        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        if (req.file) {
            if (product.image) {
                const fullPath = resolveImagePath(product.image);
                fs.unlink(fullPath, (err) => {
                    if (err && err.code !== "ENOENT") {
                        console.error("Error deleting old image file:", err.message);
                    }
                });
            }

            product.image = `uploads/${req.file.filename}`;
        }

        const parsedCategories = categories !== undefined
            ? normalizeCategories(categories, product.categories)
            : product.categories;

        const hasQuantityInRequest = quantity !== undefined;
        const normalizedQuantity = normalizeQuantity(quantity);

        if (!Array.isArray(parsedCategories) || parsedCategories.length === 0) {
            return res.status(400).json({ message: "At least one valid category is required" });
        }

        product.name = name || product.name;
        product.price = price ?? product.price;
        if (hasQuantityInRequest) {
            if (!normalizedQuantity) {
                return res.status(400).json({ message: "Quantity is required" });
            }

            product.quantity = normalizedQuantity;
        }
        product.description = description ?? product.description;
        product.categories = parsedCategories;

        const updatedProduct = await product.save();

        return res.status(200).json({
            message: "Product updated successfully",
            product: updatedProduct,
        });
    } catch (error) {
        console.error("Update Product Error:", error);
        return res.status(500).json({ message: "Server error while updating product" });
    }
});


router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const product = await Product.findById(id);

        if (product.image) {
            const fullPath = resolveImagePath(product.image);

            fs.unlink(fullPath, (err) => {
                if (err && err.code !== "ENOENT") {
                    console.error("Error deleting image file:", err.message);
                }
            });
        }

        const deletedProduct = await Product.findByIdAndDelete(id);

        if (!deletedProduct) {
            return res.status(404).json({ message: "Product not found" });
        }

        return res.status(200).json({ message: "Product removed successfully" });
    } catch (error) {
        console.error("Delete Product Error:", error);
        return res.status(500).json({ message: "Server error while deleting product" });
    }
});

router.use((error, _req, res, next) => {
    if (error instanceof multer.MulterError) {
        return res.status(400).json({ message: error.message });
    }

    if (error?.message === "Only image files are allowed") {
        return res.status(400).json({ message: error.message });
    }

    return next(error);
});
export default router;
