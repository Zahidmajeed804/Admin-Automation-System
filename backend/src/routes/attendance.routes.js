import { Router } from "express";
import { attendanceController } from "../controllers/attendanceController.js";
import {
  clockInValidator,
  clockOutValidator,
  listAttendanceValidator,
  updateAttendanceValidator,
} from "../validators/attendanceValidators.js";
import { authenticate } from "../middleware/authenticate.js";
import { requirePermission } from "../authorization/requirePermission.js";

const router = Router();

router.use(authenticate);

router.get("/", requirePermission("attendance.read"), listAttendanceValidator, attendanceController.list);
router.get("/employees", requirePermission("attendance.update"), attendanceController.employees);
router.get("/me/today", requirePermission("attendance.read"), attendanceController.today);
router.post("/clock-in", requirePermission("attendance.create"), clockInValidator, attendanceController.clockIn);
router.post("/clock-out", requirePermission("attendance.create"), clockOutValidator, attendanceController.clockOut);

router.patch("/:id", requirePermission("attendance.update"), updateAttendanceValidator, attendanceController.update);

export default router;
