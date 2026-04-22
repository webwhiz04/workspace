import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/auth.js";
import productRoutes from "./routes/products.js";
import userDataRoutes from "./routes/userdata.js";
import paymentRoutes from "./routes/payment.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const PORT = Number(process.env.PORT) || 5000;
app.use(cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
}));

app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/uploads", express.static(path.resolve("uploads")));

mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        console.log("MongoDB Connected");

        try {
            await mongoose.connection.collection("users").dropIndex("phone_1");
            console.log("Dropped legacy users.phone_1 index");
        } catch (error) {
            if (error.codeName !== "IndexNotFound") {
                console.error("Index cleanup error:", error.message);
            }
        }
    })
    .catch((err) => console.error("MongoDB Error:", err));

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/userdata", userDataRoutes);
app.use("/api/payment", paymentRoutes);

app.use((req, res) => {
    return res.status(404).json({ message: `Cannot ${req.method} ${req.originalUrl}` });
});

app.use((error, _req, res, _next) => {
    console.error("Unhandled Server Error:", error);
    return res.status(500).json({ message: "Internal server error" });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});