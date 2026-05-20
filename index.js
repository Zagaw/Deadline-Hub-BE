import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from 'url';
dotenv.config();

import sequelize from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import deadlineRoutes from "./routes/deadlineRoutes.js";
import errorMiddleware from "./middleware/errorMiddleware.js";

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/deadlines", deadlineRoutes);

// Test route
app.get("/", (req, res) => {
  res.send("Deadline Management API is running...");
});

// Error middleware
app.use(errorMiddleware);

// Sync DB & start server
sequelize.sync({ alter: true })
  .then(async () => {
    console.log("Database connected & tables created");
    
    // Set up associations
    const User = await import('./models/User.js').then(m => m.default);
    const Deadline = await import('./models/Deadline.js').then(m => m.default);
    
    // Define associations
    User.hasMany(Deadline, { foreignKey: 'userId', onDelete: 'CASCADE' });
    Deadline.belongsTo(User, { foreignKey: 'userId' });

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => console.log(err));