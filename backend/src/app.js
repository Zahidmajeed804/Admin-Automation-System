import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

import { env, isProduction } from "./config/env.js";
import routes from "./routes/index.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

const app = express();

// Security & core middleware
app.use(helmet());
app.use(
  cors({
    origin: env.clientOrigin,
    credentials: true,
  })
);
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
// Jest sets NODE_ENV=test; skip the per-request access log so test output stays readable.
if (env.nodeEnv !== "test") app.use(morgan(isProduction ? "combined" : "dev"));

// Basic rate limiting on the whole API surface; stricter limits (e.g. on
// /auth/login) get layered on in the module that owns that route.
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(`/api/${env.apiVersion}`, globalLimiter);

// Versioned API
app.use(`/api/${env.apiVersion}`, routes);

// 404 + centralized error handler (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
