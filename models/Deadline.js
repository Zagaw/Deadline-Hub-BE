// models/Deadline.js
import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Deadline = sequelize.define("Deadline", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: "Title is required" },
      len: [3, 100]
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  dueDate: {
    type: DataTypes.DATE,
    allowNull: false,
    validate: {
      isDate: true,
      isAfterToday(value) {
        // Remove or comment out this validation for testing
        // if (value && new Date(value) < new Date()) {
        //   throw new Error('Due date cannot be in the past');
        // }
      }
    }
  },
  dueTime: {
    type: DataTypes.TIME,
    allowNull: false,
  },
  fileUrl: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  fileName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  fileSize: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  fileType: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'overdue'),
    defaultValue: 'pending',
    allowNull: false,
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
    defaultValue: 'medium',
    allowNull: false,
  },
  reminderSent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  // Add these new fields for group tasks
  isGroupTask: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  roomId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  }
}, {
  timestamps: true,
  indexes: [
    {
      fields: ['userId']
    },
    {
      fields: ['dueDate']
    },
    {
      fields: ['status']
    },
    {
      fields: ['userId', 'status']
    },
    {
      fields: ['roomId'] // Add index for roomId
    }
  ]
});

export default Deadline;