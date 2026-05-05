import express from "express";
import { register, login, createAdmin, getAllUsers, getUserById, deleteUser } from "../controllers/authController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { authorizeRoles, isAdmin } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);

// Protected routes (example)
router.get("/profile", authMiddleware, (req, res) => {
  res.json({ message: "Protected profile data", userId: req.user.id });
});

// Protected routes - Admin only
router.post("/create-admin", authMiddleware, isAdmin, createAdmin);
router.get("/users", authMiddleware, isAdmin, getAllUsers);
router.get("/users/:id", authMiddleware, isAdmin, getUserById);
router.delete("/users/:id", authMiddleware, isAdmin, deleteUser);

// Example of role-based access with multiple roles
router.get("/dashboard", 
  authMiddleware, 
  authorizeRoles('admin', 'user'), 
  (req, res) => {
    res.json({ 
      message: `Welcome ${req.user.role}! This is your dashboard.`,
      userId: req.user.id,
      role: req.user.role
    });
  }
);

// Admin-only analytics route
router.get("/analytics", 
  authMiddleware, 
  authorizeRoles('admin'), 
  (req, res) => {
    res.json({ 
      message: "Admin analytics data",
      stats: {
        totalUsers: 0,
        activeSessions: 0
      }
    });
  }
);

export default router;