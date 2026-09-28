import { leaveRepository } from "../repositories/leaveRepository.js";
import { userRepository } from "../repositories/userRepository.js";
import { LEAVE_TYPES, REVIEW_DECISIONS } from "../constants/attendance.js";
import { startOfDay } from "../utils/dates.js";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../errors/AppError.js";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
// Leave types that draw down a yearly allocation. Unpaid leave has none — no
// balance to check and no limit on how much of it someone can request.
const QUOTA_LEAVE_TYPES = ["casual", "sick", "annual"];

// Inclusive days of [start, end] that fall within `year` — 0 if the range misses
// the year entirely. Used so a request or an existing request that straddles a
// year boundary (e.g. 28 Dec to 3 Jan) is only counted against each year for the
// days it actually occupies in that year, not its whole length.
const daysInYear = (start, end, year) => {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year, 11, 31));
  const clampedStart = start > yearStart ? start : yearStart;
  const clampedEnd = end < yearEnd ? end : yearEnd;
  if (clampedEnd < clampedStart) return 0;
  return Math.round((clampedEnd - clampedStart) / MS_PER_DAY) + 1;
};

// Every calendar year a [start, end] range touches, in order.
const yearsTouched = (start, end) => {
  const years = [];
  for (let y = start.getUTCFullYear(); y <= end.getUTCFullYear(); y++) years.push(y);
  return years;
};

export const leaveService = {
  // Reviewers (canViewAll, i.e. leave.approve) may see everyone or filter by userId;
  // everyone else is always scoped to their own requests.
  async list({ requesterId, canViewAll = false, userId, status, leaveType, startDate, endDate, page, pageSize }) {
    const scopedUserId = canViewAll ? userId : requesterId;
    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safePageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(pageSize, 10) || DEFAULT_PAGE_SIZE));

    const { items, totalItems } = await leaveRepository.list({
      userId: scopedUserId,
      status,
      leaveType,
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

  // A user can't hold two live (pending/approved) requests over the same days;
  // a rejected request frees its days again.
  async create(userId, { leaveType, startDate, endDate, reason }) {
    if (!LEAVE_TYPES.includes(leaveType)) {
      throw new BadRequestError(`leaveType must be one of: ${LEAVE_TYPES.join(", ")}`);
    }

    const start = startOfDay(startDate);
    const end = startOfDay(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestError("startDate and endDate must be valid dates");
    }
    if (end < start) {
      throw new BadRequestError("endDate must not be before startDate");
    }

    const clash = await leaveRepository.findOverlapping(userId, start, end);
    if (clash) {
      const article = clash.status === "approved" ? "an" : "a";
      throw new ConflictError(`You already have ${article} ${clash.status} leave request overlapping these dates`);
    }

    if (QUOTA_LEAVE_TYPES.includes(leaveType)) {
      await leaveService.assertWithinBalance(userId, leaveType, start, end);
    }

    return leaveRepository.create({
      user: userId,
      leaveType,
      startDate: start,
      endDate: end,
      totalDays: Math.round((end - start) / MS_PER_DAY) + 1,
      reason,
    });
  },

  // Throws if requesting [start, end] of `leaveType` would exceed the user's yearly
  // allocation, checking each calendar year the range touches independently — a
  // request spanning New Year's only draws against each year for the days it
  // actually falls on. Unpaid leave never reaches this (see QUOTA_LEAVE_TYPES).
  async assertWithinBalance(userId, leaveType, start, end) {
    const user = await userRepository.findById(userId);
    const allocated = user?.leaveAllocation?.[leaveType] || 0;

    for (const year of yearsTouched(start, end)) {
      const requestedInYear = daysInYear(start, end, year);
      if (requestedInYear === 0) continue;

      const { remaining } = await leaveService.getBalanceForYear(userId, leaveType, year, allocated);
      if (requestedInYear > remaining) {
        throw new BadRequestError(`Only ${remaining} ${leaveType} day${remaining === 1 ? "" : "s"} left for ${year}`);
      }
    }
  },

  // Existing pending/approved days of `leaveType` in `year`, split into used
  // (approved) and pending, clipped per request the same way assertWithinBalance
  // clips the incoming one. Shared by the quota check above and the balance
  // endpoint (leaveController.balance), so both agree on the same numbers.
  async getBalanceForYear(userId, leaveType, year, allocated) {
    const existing = await leaveRepository.findActiveByTypeAndYear(userId, leaveType, year);
    let used = 0;
    let pending = 0;
    for (const request of existing) {
      const days = daysInYear(request.startDate, request.endDate, year);
      if (request.status === "approved") used += days;
      else pending += days;
    }
    return { allocated, used, pending, remaining: Math.max(0, allocated - used - pending) };
  },

  // Allocated/used/pending/remaining for every quota-limited leave type, for one
  // person in one year. Unpaid leave is left out — it has no allocation to report.
  async getBalance(userId, year) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    const balances = {};
    for (const leaveType of QUOTA_LEAVE_TYPES) {
      const allocated = user.leaveAllocation?.[leaveType] || 0;
      balances[leaveType] = await leaveService.getBalanceForYear(userId, leaveType, year, allocated);
    }
    return balances;
  },

  // Approve or reject a pending request. A request is decided once; nobody reviews their own.
  async review(id, { reviewerId, decision, note }) {
    if (!REVIEW_DECISIONS.includes(decision)) {
      throw new BadRequestError(`decision must be one of: ${REVIEW_DECISIONS.join(", ")}`);
    }

    const request = await leaveRepository.findById(id);
    if (!request) {
      throw new NotFoundError("Leave request not found");
    }
    if (String(request.user) === String(reviewerId)) {
      throw new ForbiddenError("You cannot review your own leave request");
    }

    const reviewed = await leaveRepository.reviewIfPending(id, {
      status: decision,
      reviewedBy: reviewerId,
      reviewNote: note,
    });
    if (!reviewed) {
      // Lost the race, or it was already decided before we got here.
      throw new ConflictError(`Leave request is already ${request.status === "pending" ? "reviewed" : request.status}`);
    }
    return reviewed;
  },
};
