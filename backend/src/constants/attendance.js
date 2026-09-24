// Allowed values for the Attendance module, shared by models, validators and services
// so a value is defined once.
export const ATTENDANCE_STATUSES = ["present", "absent", "half-day", "late"];
export const OVERTIME_STATUSES = ["pending", "approved", "rejected"];
export const LEAVE_TYPES = ["casual", "sick", "annual", "unpaid"];
export const LEAVE_STATUSES = ["pending", "approved", "rejected"];
// What a reviewer may decide on a pending overtime or leave request; maps 1:1 onto the status.
export const REVIEW_DECISIONS = ["approved", "rejected"];
