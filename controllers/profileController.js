import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken"; 
import { Op } from "sequelize";

// Store blacklisted tokens (in production, use Redis or database)
const tokenBlacklist = new Set();

// Logout function - blacklist the token
export const logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    
    if (token) {
      // Add token to blacklist
      tokenBlacklist.add(token);
      
      // Optional: Set expiry to clean up blacklist (e.g., remove after token expiry time)
      const tokenExpiry = req.user.exp ? req.user.exp * 1000 : Date.now() + 7 * 24 * 60 * 60 * 1000;
      setTimeout(() => {
        tokenBlacklist.delete(token);
      }, tokenExpiry - Date.now());
    }
    
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Check if token is blacklisted
export const isTokenBlacklisted = (token) => {
  return tokenBlacklist.has(token);
};

// Get user profile
export const getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update username
export const updateUsername = async (req, res) => {
  try {
    const { username } = req.body;
    const userId = req.user.id;
    
    if (!username || username.trim() === "") {
      return res.status(400).json({ message: "Username is required" });
    }
    
    if (username.length < 3) {
      return res.status(400).json({ message: "Username must be at least 3 characters" });
    }
    
    if (username.length > 50) {
      return res.status(400).json({ message: "Username cannot exceed 50 characters" });
    }
    
    // Check if username already exists (excluding current user)
    const existingUser = await User.findOne({
      where: {
        username: username,
        id: { [Op.ne]: userId }
      }
    });
    
    if (existingUser) {
      return res.status(409).json({ message: "Username already taken" });
    }
    
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Update username
    user.username = username;
    await user.save();
    
    res.json({
      message: "Username updated successfully",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update email
export const updateEmail = async (req, res) => {
  try {
    const { email } = req.body;
    const userId = req.user.id;
    
    if (!email || email.trim() === "") {
      return res.status(400).json({ message: "Email is required" });
    }
    
    // Email format validation
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }
    
    // Check if email already exists (excluding current user)
    const existingUser = await User.findOne({
      where: {
        email: email,
        id: { [Op.ne]: userId }
      }
    });
    
    if (existingUser) {
      return res.status(409).json({ message: "Email already registered" });
    }
    
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Update email
    user.email = email;
    await user.save();
    
    // Generate new token with updated user info
    const newToken = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    
    res.json({
      message: "Email updated successfully. Please use new token for future requests.",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      },
      token: newToken
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update password
export const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.user.id;
    
    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: "All password fields are required" });
    }
    
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "New passwords do not match" });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }
    
    if (currentPassword === newPassword) {
      return res.status(400).json({ message: "New password must be different from current password" });
    }
    
    // Get user with password
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password
    user.password = hashedPassword;
    await user.save();
    
    res.json({ message: "Password updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update full profile (username + password combined)
export const updateFullProfile = async (req, res) => {
  try {
    const { username, email, currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.user.id;
    
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const updates = {};
    let requiresNewToken = false;
    
    // Update username if provided
    if (username && username !== user.username) {
      if (username.length < 3) {
        return res.status(400).json({ message: "Username must be at least 3 characters" });
      }
      
      const existingUser = await User.findOne({
        where: {
          username: username,
          id: { [Op.ne]: userId }
        }
      });
      
      if (existingUser) {
        return res.status(409).json({ message: "Username already taken" });
      }
      
      updates.username = username;
    }
    
    // Update email if provided
    if (email && email !== user.email) {
      const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email format" });
      }
      
      const existingUser = await User.findOne({
        where: {
          email: email,
          id: { [Op.ne]: userId }
        }
      });
      
      if (existingUser) {
        return res.status(409).json({ message: "Email already registered" });
      }
      
      updates.email = email;
      requiresNewToken = true;
    }
    
    // Update password if provided
    if (currentPassword || newPassword || confirmPassword) {
      if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({ message: "All password fields are required to change password" });
      }
      
      if (newPassword !== confirmPassword) {
        return res.status(400).json({ message: "New passwords do not match" });
      }
      
      if (newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }
      
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }
      
      updates.password = await bcrypt.hash(newPassword, 10);
    }
    
    // Apply updates
    await user.update(updates);
    
    // Prepare response
    const response = {
      message: "Profile updated successfully",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    };
    
    // Generate new token if email changed
    if (requiresNewToken) {
      const newToken = jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );
      response.token = newToken;
      response.message += ". Please use new token for future requests.";
    }
    
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete own account
export const deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;
    const userId = req.user.id;
    
    if (!password) {
      return res.status(400).json({ message: "Password is required to delete account" });
    }
    
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Incorrect password" });
    }
    
    // Delete the user
    await user.destroy();
    
    // Blacklist the current token
    const token = req.headers.authorization?.split(" ")[1];
    if (token) {
      tokenBlacklist.add(token);
    }
    
    res.json({ message: "Account deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};