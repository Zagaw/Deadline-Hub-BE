import Deadline from "../models/Deadline.js";
import User from "../models/User.js";
import { Op } from "sequelize";
import multer from "multer";
import path from "path";
import fs from "fs";

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/deadlines';
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, images, and Word documents are allowed.'), false);
  }
};

export const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter
});

// controllers/deadlineController.js - Update the createDeadline function
export const createDeadline = async (req, res) => {
  try {
    const { title, description, dueDate, dueTime, priority, isGroupTask, roomId } = req.body;
    const userId = req.user.id;

    console.log('Received data:', { title, description, dueDate, dueTime, priority, isGroupTask, roomId }); // Debug log

    // Validate required fields
    if (!title || !dueDate || !dueTime) {
      return res.status(400).json({ message: "Title, due date, and due time are required" });
    }

    // Handle file upload
    let fileData = {};
    if (req.file) {
      fileData = {
        fileUrl: `/uploads/deadlines/${req.file.filename}`,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        fileType: req.file.mimetype
      };
    }

    // Parse due date properly
    let parsedDueDate;
    try {
      parsedDueDate = new Date(dueDate);
      if (isNaN(parsedDueDate.getTime())) {
        throw new Error('Invalid date');
      }
    } catch (error) {
      return res.status(400).json({ message: "Invalid due date format" });
    }

    // Create deadline with all fields
    const deadline = await Deadline.create({
      userId,
      title,
      description: description || '',
      dueDate: parsedDueDate,
      dueTime: dueTime,
      priority: priority || 'medium',
      isGroupTask: isGroupTask === 'true' || isGroupTask === true || false,
      roomId: roomId || null,
      ...fileData
    });

    // Fetch user details for response
    const user = await User.findByPk(userId, {
      attributes: ['id', 'username', 'email']
    });

    res.status(201).json({
      message: "Deadline created successfully",
      deadline: {
        ...deadline.toJSON(),
        user
      }
    });
  } catch (error) {
    console.error('Create deadline error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get all deadlines for authenticated user
// controllers/deadlineController.js - Update the getUserDeadlines function
export const getUserDeadlines = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, priority, search, page = 1, limit = 10 } = req.query;

    const where = { userId };
    
    // Filter by status
    if (status && status !== 'all') {
      where.status = status;
    }
    
    // Filter by priority
    if (priority && priority !== 'all') {
      where.priority = priority;
    }
    
    // Search by title or description
    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }

    const offset = (page - 1) * limit;
    
    const { count, rows: deadlines } = await Deadline.findAndCountAll({
      where,
      order: [['dueDate', 'ASC'], ['dueTime', 'ASC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Update overdue status
    const now = new Date();
    for (const deadline of deadlines) {
      const deadlineDateTime = new Date(`${deadline.dueDate.toISOString().split('T')[0]}T${deadline.dueTime}`);
      if (deadline.status === 'pending' && deadlineDateTime < now) {
        deadline.status = 'overdue';
        await deadline.save();
      }
    }

    // Format the deadlines for frontend
    const formattedDeadlines = deadlines.map(deadline => {
      const deadlineObj = deadline.toJSON();
      return {
        ...deadlineObj,
        dueDate: deadline.dueDate ? deadline.dueDate.toISOString().split('T')[0] : null,
        dueTime: deadline.dueTime || '12:00:00',
        isGroupTask: deadlineObj.isGroupTask || false,
        roomId: deadlineObj.roomId || null
      };
    });

    res.json({
      deadlines: formattedDeadlines,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page)
    });
  } catch (error) {
    console.error('Get deadlines error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get single deadline by ID
export const getDeadlineById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const deadline = await Deadline.findOne({
      where: { id, userId },
      include: [{
        model: User,
        attributes: ['id', 'username', 'email']
      }]
    });

    if (!deadline) {
      return res.status(404).json({ message: "Deadline not found" });
    }

    res.json(deadline);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update deadline
export const updateDeadline = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { title, description, dueDate, dueTime, priority, status } = req.body;

    const deadline = await Deadline.findOne({ where: { id, userId } });

    if (!deadline) {
      return res.status(404).json({ message: "Deadline not found" });
    }

    // Handle file upload if new file is provided
    let fileData = {};
    if (req.file) {
      // Delete old file if exists
      if (deadline.fileUrl) {
        const oldFilePath = path.join(process.cwd(), deadline.fileUrl);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }
      
      fileData = {
        fileUrl: `/uploads/deadlines/${req.file.filename}`,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        fileType: req.file.mimetype
      };
    }

    // Update deadline
    await deadline.update({
      title: title || deadline.title,
      description: description !== undefined ? description : deadline.description,
      dueDate: dueDate ? new Date(dueDate) : deadline.dueDate,
      dueTime: dueTime || deadline.dueTime,
      priority: priority || deadline.priority,
      status: status || deadline.status,
      ...fileData
    });

    // If status is completed, set completedAt timestamp
    if (status === 'completed' && deadline.status !== 'completed') {
      deadline.completedAt = new Date();
      await deadline.save();
    }

    res.json({
      message: "Deadline updated successfully",
      deadline
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete deadline
export const deleteDeadline = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const deadline = await Deadline.findOne({ where: { id, userId } });

    if (!deadline) {
      return res.status(404).json({ message: "Deadline not found" });
    }

    // Delete associated file if exists
    if (deadline.fileUrl) {
      const filePath = path.join(process.cwd(), deadline.fileUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await deadline.destroy();

    res.json({ message: "Deadline deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Mark deadline as completed
export const completeDeadline = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const deadline = await Deadline.findOne({ where: { id, userId } });

    if (!deadline) {
      return res.status(404).json({ message: "Deadline not found" });
    }

    if (deadline.status === 'completed') {
      return res.status(400).json({ message: "Deadline is already completed" });
    }

    deadline.status = 'completed';
    deadline.completedAt = new Date();
    await deadline.save();

    res.json({
      message: "Deadline marked as completed",
      deadline
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get upcoming deadlines (next 7 days)
export const getUpcomingDeadlines = async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(now.getDate() + 7);

    const deadlines = await Deadline.findAll({
      where: {
        userId,
        status: 'pending',
        dueDate: {
          [Op.between]: [now, nextWeek]
        }
      },
      order: [['dueDate', 'ASC'], ['dueTime', 'ASC']]
    });

    res.json(deadlines);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get deadline statistics
export const getDeadlineStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const total = await Deadline.count({ where: { userId } });
    const pending = await Deadline.count({ where: { userId, status: 'pending' } });
    const completed = await Deadline.count({ where: { userId, status: 'completed' } });
    const overdue = await Deadline.count({ where: { userId, status: 'overdue' } });

    // Priority counts
    const highPriority = await Deadline.count({ where: { userId, priority: 'high' } });
    const mediumPriority = await Deadline.count({ where: { userId, priority: 'medium' } });
    const lowPriority = await Deadline.count({ where: { userId, priority: 'low' } });
    const urgentPriority = await Deadline.count({ where: { userId, priority: 'urgent' } });

    res.json({
      total,
      pending,
      completed,
      overdue,
      priorities: {
        high: highPriority,
        medium: mediumPriority,
        low: lowPriority,
        urgent: urgentPriority
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};