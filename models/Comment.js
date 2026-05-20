import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Comment = sequelize.define("Comment", {
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
  deadlineId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Deadlines',
      key: 'id'
    }
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: { msg: "Comment content cannot be empty" }
    }
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
  isEdited: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  editedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  parentCommentId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Comments',
      key: 'id'
    }
  }
}, {
  timestamps: true,
  indexes: [
    {
      fields: ['deadlineId']
    },
    {
      fields: ['userId']
    },
    {
      fields: ['createdAt']
    },
    {
      fields: ['deadlineId', 'createdAt']
    }
  ]
});

// Add associations (to be defined in server.js)
export const associate = (models) => {
  Comment.belongsTo(models.User, { foreignKey: 'userId' });
  Comment.belongsTo(models.Deadline, { foreignKey: 'deadlineId' });
  Comment.belongsTo(models.Comment, { foreignKey: 'parentCommentId', as: 'parent' });
  Comment.hasMany(models.Comment, { foreignKey: 'parentCommentId', as: 'replies' });
};

export default Comment;