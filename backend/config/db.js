import mongoose from "mongoose";

import config from "./config.js";

const connectDB = async () => {
  try {
    if (!config.MONGO_URI) {
      throw new Error("MONGO_URI is not defined in environment variables");
    }

    const conn = await mongoose.connect(config.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Clean up legacy indexes
    try {
      await mongoose.connection.collection("users").dropIndex("phone_1");
      console.log("Dropped legacy users.phone_1 index");
    } catch (error) {
      if (error.codeName !== "IndexNotFound") {
        console.error("Index cleanup error:", error.message);
      }
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
