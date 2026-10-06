import { attendanceRepository } from "../repositories/attendanceRepository.js";
import { userRepository } from "../repositories/userRepository.js";
import { overtimeRepository } from "../repositories/overtimeRepository.js";
import { env } from "../config/env.js";
import { startOfDay } from "../utils/dates.js";
import { BadRequestError, ConflictError, NotFoundError } from "../errors/AppError.js";

// Below this many worked minutes in a day, status is "half-day" instead of "present".
const HALF_DAY_THRESHOLD_MINUTES = 240;

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const minutesBetween = (from, to) => Math.max(0, Math.round((to - from) / 60000));

const statusForWorkedMinutes = (minutes) =>
  minutes < HALF_DAY_THRESHOLD_MINUTES ? "half-day" : "present";

// The shift starts at clock-in and lasts shiftMinutes, so overtime starts exactly
// where the shift ends. Leaving before that is an early departure.
const earlyDepartureFor = (workedMinutes, shiftMinutes) => Math.max(0, shiftMinutes - workedMinutes);

// A person's shift comes from their designation (8h, 9h, ...). Someone with no
// designation gets the default shift from OVERTIME_THRESHOLD_MINUTES. A designation
// that was deactivated still applies to the people who hold it.
async function resolveShiftMinutes(userId) {
  const user = await userRepository.findByIdWithDesignation(userId);
  const shiftHours = user?.designation?.shiftHours;
  return shiftHours ? Math.round(shiftHours * 60) : env.overtimeThresholdMinutes;
}

export const attendanceService = {
  async getToday(userId) {
    return attendanceRepository.findTodayForUser(userId);
  },

  // People a manager can pick from when filtering attendance by employee.
  // Includes inactive users so a former employee's history stays reachable.
  async listEmployees() {
    return userRepository.listAll();
  },

  // Users with canViewAll (attendance.update) may filter by any userId, or omit
  // it to see everyone; everyone else is always scoped to their own records.
  async list({ requesterId, canViewAll = false, userId, status, startDate, endDate, page, pageSize }) {
    const scopedUserId = canViewAll ? userId : requesterId;
    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safePageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(pageSize, 10) || DEFAULT_PAGE_SIZE));

    const { items, totalItems } = await attendanceRepository.list({
      userId: scopedUserId,
      status,
      startDate,
      endDate,
      page: safePage,
      pageSize: safePageSize,
    });

    return {
      items,
      pagination: {
        page: safePage,
        pageSize: safePageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / safePageSize),
      },
    };
  },

  async clockIn(userId) {
    const now = new Date();
    const existing = await attendanceRepository.findTodayForUser(userId, now);
    if (existing?.clockIn) {
      throw new ConflictError("Already clocked in today");
    }

    if (existing) {
      return attendanceRepository.updateById(existing._id, { clockIn: now });
    }

    return attendanceRepository.create({
      user: userId,
      date: startOfDay(now),
      clockIn: now,
    });
  },

  async clockOut(userId) {
    const now = new Date();
    const record = await attendanceRepository.findTodayForUser(userId, now);
    if (!record?.clockIn) {
      throw new NotFoundError("No clock-in found for today");
    }
    if (record.clockOut) {
      throw new ConflictError("Already clocked out today");
    }

    const workedMinutes = minutesBetween(record.clockIn, now);
    const status = statusForWorkedMinutes(workedMinutes);
    const shiftMinutes = await resolveShiftMinutes(userId);

    const updated = await attendanceRepository.updateById(record._id, {
      clockOut: now,
      workedMinutes,
      status,
      shiftMinutes,
      earlyDepartureMinutes: earlyDepartureFor(workedMinutes, shiftMinutes),
    });

    const overtimeMinutes = workedMinutes - shiftMinutes;
    if (overtimeMinutes > 0) {
      await overtimeRepository.createForAttendance({
        user: userId,
        attendance: record._id,
        date: record.date,
        overtimeMinutes,
      });
    }

    return updated;
  },

  // Manager/admin correction. Changing clock times recomputes workedMinutes and
  // status (same rules as clockOut); an explicit status in the payload wins.
  async update(id, { clockIn, clockOut, status, notes }) {
    const record = await attendanceRepository.findById(id);
    if (!record) {
      throw new NotFoundError("Attendance record not found");
    }

    const newClockIn = clockIn ? new Date(clockIn) : record.clockIn;
    const newClockOut = clockOut ? new Date(clockOut) : record.clockOut;

    // record.date is the one-record-per-day key, so clockIn can't move to another day.
    if (clockIn && startOfDay(newClockIn).getTime() !== record.date.getTime()) {
      throw new BadRequestError("clockIn must fall on the record's date");
    }
    if (newClockOut && !newClockIn) {
      throw new BadRequestError("clockOut requires a clockIn");
    }
    if (newClockOut && newClockOut < newClockIn) {
      throw new BadRequestError("clockOut must not be before clockIn");
    }

    const changes = {};
    if (clockIn) changes.clockIn = newClockIn;
    if (clockOut) changes.clockOut = newClockOut;
    if (notes !== undefined) changes.notes = notes;
    if (newClockIn && newClockOut && (clockIn || clockOut)) {
      // Keep the shift the day was first measured against; an open or older record
      // takes the person's current shift and stores it from now on.
      const shiftMinutes = record.shiftMinutes ?? (await resolveShiftMinutes(record.user));
      changes.workedMinutes = minutesBetween(newClockIn, newClockOut);
      changes.status = statusForWorkedMinutes(changes.workedMinutes);
      changes.shiftMinutes = shiftMinutes;
      changes.earlyDepartureMinutes = earlyDepartureFor(changes.workedMinutes, shiftMinutes);
    }
    if (status) changes.status = status;

    return attendanceRepository.updateById(id, changes);
  },
};
