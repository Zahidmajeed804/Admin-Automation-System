import { useCallback, useEffect, useState } from "react";
import { Clock, Timer, LogIn, LogOut } from "lucide-react";
import { attendanceService } from "../../services/attendanceService";
import Card from "../common/Card";
import StatCard from "../common/StatCard";
import Button from "../common/Button";
import Badge from "../common/Badge";
import ErrorState from "../common/ErrorState";
import { CardSkeleton } from "../common/Loading";
import { formatTime, formatDuration, statusBadgeKey } from "../../utils/attendanceFormat";

const TICK_MS = 30_000;

/**
 * Self-service clock-in/out for the signed-in user: today's status, live
 * time worked while clocked in, and the single action that makes sense next.
 * `onChange` fires after a successful clock-in/out so siblings can refresh.
 */
export default function ClockWidget({ onChange }) {
  const [attendance, setAttendance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(
    () =>
      attendanceService
        .today()
        .then((record) => {
          setAttendance(record);
          setNow(Date.now());
          setLoadFailed(false);
        })
        .catch(() => setLoadFailed(true))
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  const clockedIn = Boolean(attendance?.clockIn);
  const clockedOut = Boolean(attendance?.clockOut);
  const running = clockedIn && !clockedOut;

  // Re-render periodically so "time worked" stays live while clocked in.
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [running]);

  const retry = () => {
    setLoading(true);
    load();
  };

  const run = async (action, fallbackMessage) => {
    setActing(true);
    setActionError("");
    try {
      setAttendance(await action());
      setNow(Date.now());
      onChange?.();
    } catch (err) {
      setActionError(err?.response?.data?.message || fallbackMessage);
      // 409 = another tab/device already did this; resync with the server.
      if (err?.response?.status === 409) load();
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (loadFailed) {
    return (
      <Card>
        <ErrorState
          title="Couldn't load today's attendance"
          description="Check your connection and try again."
          onRetry={retry}
        />
      </Card>
    );
  }

  const elapsedMinutes = running
    ? Math.max(0, Math.floor((now - new Date(attendance.clockIn).getTime()) / 60000))
    : null;
  const workedMinutes = clockedOut ? attendance.workedMinutes : elapsedMinutes;

  const statusLabel = clockedOut ? "Clocked out" : clockedIn ? "Clocked in" : "Not clocked in";
  const statusTone = running
    ? { iconColor: "text-status-success", iconBg: "bg-status-successBg" }
    : {};
  const hint = clockedOut
    ? `Clocked out at ${formatTime(attendance.clockOut)}. You're done for today.`
    : clockedIn
      ? `Clocked in at ${formatTime(attendance.clockIn)}. Clock out when you finish.`
      : "Clock in to start today's attendance.";

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <StatCard label="Today's status" value={statusLabel} icon={Clock} {...statusTone} />
      <StatCard
        label="Time worked today"
        value={workedMinutes === null ? "—" : formatDuration(workedMinutes)}
        icon={Timer}
      />
      <Card className="flex flex-col justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-body text-ink-secondary">Attendance</span>
          <p className="text-helper text-ink-muted">{hint}</p>
          {clockedOut && (
            <div className="mt-1">
              <Badge status={statusBadgeKey[attendance.status]} />
            </div>
          )}
        </div>
        {actionError && (
          <div className="bg-status-errorBg border border-red-200 text-status-error text-helper rounded-md px-3 py-2">
            {actionError}
          </div>
        )}
        {clockedOut ? (
          <Button variant="secondary" disabled className="w-full">
            Done for today
          </Button>
        ) : clockedIn ? (
          <Button
            icon={LogOut}
            loading={acting}
            className="w-full"
            onClick={() => run(attendanceService.clockOut, "Couldn't clock out. Please try again.")}
          >
            Clock out
          </Button>
        ) : (
          <Button
            icon={LogIn}
            loading={acting}
            className="w-full"
            onClick={() => run(attendanceService.clockIn, "Couldn't clock in. Please try again.")}
          >
            Clock in
          </Button>
        )}
      </Card>
    </div>
  );
}
