import dotenv from 'dotenv';
import { Sequelize } from "sequelize";

// Load .env file
dotenv.config();

console.log('=== DATABASE CONFIG DEBUG ===');
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_USERNAME:', process.env.DB_USERNAME);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '***SET***' : 'MISSING');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('===============================');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USERNAME,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: "mysql",
    logging: false,
  }
);

export default sequelize;