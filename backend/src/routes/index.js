import { Router } from "express";
import healthRoutes from "./health.routes.js";
import authRoutes from "./auth.routes.js";
import rbacRoutes from "./rbac.routes.js";
import attendanceRoutes from "./attendance.routes.js";
import overtimeRoutes from "./overtime.routes.js";
import leaveRoutes from "./leave.routes.js";

// Module route files get mounted here as they're built.
const router = Router();

router.use("/", healthRoutes);
router.use("/auth", authRoutes);
router.use("/rbac", rbacRoutes);
router.use("/attendance", attendanceRoutes);
router.use("/overtime", overtimeRoutes);
router.use("/leave", leaveRoutes);

export default router;
