import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  createDeadline,
  getUserDeadlines,
  getDeadlineById,
  updateDeadline,
  deleteDeadline,
  completeDeadline,
  getUpcomingDeadlines,
  getDeadlineStats,
  upload
} from "../controllers/deadlineController.js";

const router = express.Router();

// All deadline routes require authentication
router.use(authMiddleware);

// Deadline CRUD operations
router.post("/", upload.single('file'), createDeadline);
router.get("/", getUserDeadlines);
router.get("/upcoming", getUpcomingDeadlines);
router.get("/stats", getDeadlineStats);
router.get("/:id", getDeadlineById);
router.put("/:id", upload.single('file'), updateDeadline);
router.delete("/:id", deleteDeadline);
router.patch("/:id/complete", completeDeadline);

export default router;