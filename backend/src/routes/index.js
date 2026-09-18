import { Router } from "express";
import healthRoutes from "./health.routes.js";
import authRoutes from "./auth.routes.js";
import rbacRoutes from "./rbac.routes.js";
import generatorRoutes from "./generator.routes.js";

// Module route files get mounted here as they're built.
const router = Router();

router.use("/", healthRoutes);
router.use("/auth", authRoutes);
router.use("/rbac", rbacRoutes);
router.use("/generator", generatorRoutes);

export default router;
