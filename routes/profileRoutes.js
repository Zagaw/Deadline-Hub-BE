import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  logout,
  getProfile,
  updateUsername,
  updateEmail,
  updatePassword,
  updateFullProfile,
  deleteAccount
} from "../controllers/profileController.js";

const router = express.Router();

// All profile routes require authentication
router.use(authMiddleware);

// Logout
router.post("/logout", logout);

// Get profile
router.get("/profile", getProfile);

// Update profile (individual endpoints)
router.put("/username", updateUsername);
router.put("/email", updateEmail);
router.put("/password", updatePassword);

// Update full profile (combined)
router.put("/profile", updateFullProfile);

// Delete account
router.delete("/account", deleteAccount);

export default router;