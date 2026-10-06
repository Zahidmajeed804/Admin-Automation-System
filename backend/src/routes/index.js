import { Router } from "express";
import healthRoutes from "./health.routes.js";
import authRoutes from "./auth.routes.js";
import rbacRoutes from "./rbac.routes.js";
import userRoutes from "./user.routes.js";
import generatorRoutes from "./generator.routes.js";
import attendanceRoutes from "./attendance.routes.js";
import overtimeRoutes from "./overtime.routes.js";
import leaveRoutes from "./leave.routes.js";
import designationRoutes from "./designation.routes.js";

// Module route files get mounted here as they're built.
const router = Router();

router.use("/", healthRoutes);
router.use("/auth", authRoutes);
router.use("/rbac", rbacRoutes);
router.use("/users", userRoutes);
router.use("/generator", generatorRoutes);
router.use("/attendance", attendanceRoutes);
router.use("/overtime", overtimeRoutes);
router.use("/leave", leaveRoutes);
router.use("/designations", designationRoutes);

export default router;
