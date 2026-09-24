import dotenv from "dotenv";

dotenv.config();

// Single place that reads process.env. Every other file imports `env`
// instead of touching process.env directly.
export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5000,
  apiVersion: process.env.API_VERSION || "v1",
  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/admin_automation_system",
  jwtSecret: process.env.JWT_SECRET || "dev_secret_change_me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  // Worked minutes per day above which the excess becomes overtime (SRS: 10 hours).
  overtimeThresholdMinutes: Number(process.env.OVERTIME_THRESHOLD_MINUTES) || 600,
};

export const isProduction = env.nodeEnv === "production";
