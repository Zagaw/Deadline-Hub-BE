import dotenv from 'dotenv';
dotenv.config();

import jwt from "jsonwebtoken";
import { isTokenBlacklisted } from "../controllers/profileController.js";

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  // Check if token is blacklisted (logged out)
  if (isTokenBlacklisted(token)) {
    return res.status(401).json({ message: "Token has been invalidated. Please login again." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: "Token has expired. Please login again." });
    }
    return res.status(401).json({ message: "Invalid token" });
  }
};

export default authMiddleware;