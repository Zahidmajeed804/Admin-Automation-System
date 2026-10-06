import { Router } from "express";
import { reportsController } from "../controllers/reportsController.js";
import { authenticate } from "../middleware/authenticate.js";
import { requirePermission } from "../authorization/requirePermission.js";
import {
  attendanceSummaryReportValidator,
  attendanceSummaryExportValidator,
  overtimeSummaryReportValidator,
  overtimeSummaryExportValidator,
  leaveUsageReportValidator,
} from "../validators/reportsValidators.js";

const router = Router();

// Every route here requires authentication + the existing "reports.read"
// permission (admin + manager by default, not staff) — same gate the
// Generator module's own reports already use.
router.use(authenticate);

router.get("/attendance-summary", requirePermission("reports.read"), attendanceSummaryReportValidator, reportsController.attendanceSummary);
router.get("/attendance-summary/export", requirePermission("reports.read"), attendanceSummaryExportValidator, reportsController.attendanceSummaryExport);
router.get("/overtime-summary", requirePermission("reports.read"), overtimeSummaryReportValidator, reportsController.overtimeSummary);
router.get("/overtime-summary/export", requirePermission("reports.read"), overtimeSummaryExportValidator, reportsController.overtimeSummaryExport);
router.get("/leave-usage", requirePermission("reports.read"), leaveUsageReportValidator, reportsController.leaveUsage);

export default router;
