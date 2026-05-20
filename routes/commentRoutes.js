import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  addComment,
  getDeadlineComments,
  updateComment,
  deleteComment,
  addReply,
  getCommentThread,
  downloadCommentFile,
  uploadCommentFile
} from "../controllers/commentController.js";

const router = express.Router();

// All comment routes require authentication
router.use(authMiddleware);

// Comment CRUD operations
router.post("/deadline/:deadlineId/comment", uploadCommentFile.single('file'), addComment);
router.get("/deadline/:deadlineId/comments", getDeadlineComments);
router.put("/comment/:id", updateComment);
router.delete("/comment/:id", deleteComment);

// Reply to a comment
router.post("/deadline/:deadlineId/comment/:commentId/reply", uploadCommentFile.single('file'), addReply);

// Get comment thread
router.get("/comment/:id/thread", getCommentThread);

// Download file attachment
router.get("/comment/:id/download", downloadCommentFile);

export default router;