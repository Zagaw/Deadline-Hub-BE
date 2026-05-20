import Comment from "../models/Comment.js";
import User from "../models/User.js";
import Deadline from "../models/Deadline.js";
import multer from "multer";
import path from "path";
import fs from "fs";

// Configure multer for comment file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/comments';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'comment-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter for comments
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/jpg', 'image/gif',
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain', 'application/zip', 'application/x-zip-compressed'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Allowed: images, PDF, Word, text, zip files.'), false);
  }
};

export const uploadCommentFile = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: fileFilter
});

// Add a comment to a deadline
export const addComment = async (req, res) => {
  try {
    const { deadlineId } = req.params;
    const { content, parentCommentId } = req.body;
    const userId = req.user.id;

    // Check if deadline exists
    const deadline = await Deadline.findOne({ 
      where: { id: deadlineId, userId: req.user.id }
    });
    
    if (!deadline) {
      return res.status(404).json({ message: "Deadline not found" });
    }

    // Validate content
    if (!content || content.trim() === "") {
      return res.status(400).json({ message: "Comment content is required" });
    }

    // Handle file upload
    let fileData = {};
    if (req.file) {
      fileData = {
        fileUrl: `/uploads/comments/${req.file.filename}`,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        fileType: req.file.mimetype
      };
    }

    // Check if parent comment exists (for replies)
    if (parentCommentId) {
      const parentComment = await Comment.findOne({ 
        where: { id: parentCommentId, deadlineId }
      });
      if (!parentComment) {
        return res.status(404).json({ message: "Parent comment not found" });
      }
    }

    const comment = await Comment.create({
      userId,
      deadlineId,
      content: content.trim(),
      parentCommentId: parentCommentId || null,
      ...fileData
    });

    // Fetch user details
    const user = await User.findByPk(userId, {
      attributes: ['id', 'username', 'email']
    });

    res.status(201).json({
      message: "Comment added successfully",
      comment: {
        ...comment.toJSON(),
        user
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all comments for a deadline
export const getDeadlineComments = async (req, res) => {
  try {
    const { deadlineId } = req.params;
    const userId = req.user.id;

    // Check if deadline exists and belongs to user
    const deadline = await Deadline.findOne({ 
      where: { id: deadlineId, userId }
    });
    
    if (!deadline) {
      return res.status(404).json({ message: "Deadline not found" });
    }

    // Get all comments for this deadline
    const comments = await Comment.findAll({
      where: { deadlineId },
      include: [{
        model: User,
        attributes: ['id', 'username', 'email']
      }],
      order: [['createdAt', 'ASC']]
    });

    // Organize comments into hierarchy (main comments and replies)
    const commentMap = new Map();
    const mainComments = [];

    comments.forEach(comment => {
      commentMap.set(comment.id, { ...comment.toJSON(), replies: [] });
    });

    comments.forEach(comment => {
      const commentWithReplies = commentMap.get(comment.id);
      if (comment.parentCommentId) {
        const parent = commentMap.get(comment.parentCommentId);
        if (parent) {
          parent.replies.push(commentWithReplies);
        }
      } else {
        mainComments.push(commentWithReplies);
      }
    });

    res.json({
      deadlineId: parseInt(deadlineId),
      totalComments: comments.length,
      comments: mainComments
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update a comment (only if user owns it)
export const updateComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    const comment = await Comment.findOne({
      where: { id, userId }
    });

    if (!comment) {
      return res.status(404).json({ message: "Comment not found or unauthorized" });
    }

    if (!content || content.trim() === "") {
      return res.status(400).json({ message: "Comment content is required" });
    }

    const oldContent = comment.content;
    
    await comment.update({
      content: content.trim(),
      isEdited: true,
      editedAt: new Date()
    });

    res.json({
      message: "Comment updated successfully",
      comment: {
        id: comment.id,
        content: comment.content,
        isEdited: comment.isEdited,
        editedAt: comment.editedAt,
        oldContent: oldContent
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete a comment (soft delete or hard delete)
export const deleteComment = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const comment = await Comment.findOne({
      where: { id }
    });

    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    // Check if user owns the comment or is admin
    if (comment.userId !== userId && userRole !== 'admin') {
      return res.status(403).json({ message: "Unauthorized to delete this comment" });
    }

    // Delete associated file if exists
    if (comment.fileUrl) {
      const filePath = path.join(process.cwd(), comment.fileUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Check if comment has replies
    const replyCount = await Comment.count({ where: { parentCommentId: id } });
    
    if (replyCount > 0) {
      // Option 1: Soft delete - mark as deleted but keep replies
      await comment.update({ content: "[Comment deleted by user]", isEdited: true });
      res.json({ 
        message: "Comment marked as deleted (had replies)", 
        comment: { id: comment.id, content: comment.content }
      });
    } else {
      // Hard delete if no replies
      await comment.destroy();
      res.json({ message: "Comment deleted successfully" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Add a reply to a comment
export const addReply = async (req, res) => {
  try {
    const { deadlineId, commentId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    // Check if deadline exists
    const deadline = await Deadline.findOne({ 
      where: { id: deadlineId, userId: req.user.id }
    });
    
    if (!deadline) {
      return res.status(404).json({ message: "Deadline not found" });
    }

    // Check if parent comment exists
    const parentComment = await Comment.findOne({
      where: { id: commentId, deadlineId }
    });

    if (!parentComment) {
      return res.status(404).json({ message: "Parent comment not found" });
    }

    if (!content || content.trim() === "") {
      return res.status(400).json({ message: "Reply content is required" });
    }

    // Handle file upload for reply
    let fileData = {};
    if (req.file) {
      fileData = {
        fileUrl: `/uploads/comments/${req.file.filename}`,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        fileType: req.file.mimetype
      };
    }

    const reply = await Comment.create({
      userId,
      deadlineId,
      content: content.trim(),
      parentCommentId: commentId,
      ...fileData
    });

    const user = await User.findByPk(userId, {
      attributes: ['id', 'username', 'email']
    });

    res.status(201).json({
      message: "Reply added successfully",
      reply: {
        ...reply.toJSON(),
        user
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get comment by ID with replies
export const getCommentThread = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const comment = await Comment.findOne({
      where: { id },
      include: [
        {
          model: User,
          attributes: ['id', 'username', 'email']
        },
        {
          model: Comment,
          as: 'replies',
          include: [{
            model: User,
            attributes: ['id', 'username', 'email']
          }],
          order: [['createdAt', 'ASC']]
        }
      ]
    });

    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    // Check if user has access to the deadline
    const deadline = await Deadline.findOne({
      where: { id: comment.deadlineId, userId }
    });

    if (!deadline && req.user.role !== 'admin') {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json(comment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get file download/attachment
export const downloadCommentFile = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const comment = await Comment.findByPk(id);

    if (!comment || !comment.fileUrl) {
      return res.status(404).json({ message: "File not found" });
    }

    // Check access to the deadline
    const deadline = await Deadline.findOne({
      where: { id: comment.deadlineId, userId }
    });

    if (!deadline && req.user.role !== 'admin') {
      return res.status(403).json({ message: "Access denied" });
    }

    const filePath = path.join(process.cwd(), comment.fileUrl);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found on server" });
    }

    res.download(filePath, comment.fileName);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};