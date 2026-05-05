import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

import sequelize from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";


const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);

// Test route
app.get("/", (req, res) => {
  res.send("API is running...");
});

// Sync DB & start server
sequelize.sync({ alter: true })
  .then(() => {
    console.log("Database connected & tables created");

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => console.log(err));