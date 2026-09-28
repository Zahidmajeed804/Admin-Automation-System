import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { leaveService } from "../../services/leaveService";
import Card from "../common/Card";
import { Skeleton } from "../common/Loading";
import { leaveTypeLabel } from "../../utils/leaveFormat";

// Order matches the leave type select; unpaid isn't shown here — it has no allocation.
const QUOTA_TYPES = ["casual", "sick", "annual"];

/**
 * This year's leave balance, one card per quota-limited type. Refetches when
 * `refreshKey` changes (after submitting a request or having one reviewed).
 * Fails quietly — a balance card is a convenience, not something that should
 * block the rest of the page if the request drops.
 */
export default function LeaveBalanceCards({ refreshKey = 0 }) {
  const [balances, setBalances] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    leaveService
      .balance()
      .then(({ balances: b }) => {
        if (!cancelled) setBalances(b);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (failed) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {QUOTA_TYPES.map((type) => {
        const balance = balances?.[type];
        return (
          <Card key={type} className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-body text-ink-secondary">{leaveTypeLabel[type]}</span>
              <span className="h-8 w-8 rounded-md flex items-center justify-center bg-surface-blue">
                <CalendarDays className="h-4 w-4 text-primary" />
              </span>
            </div>
            {balance ? (
              <>
                <div className="text-2xl font-semibold text-ink leading-none">
                  {balance.remaining}
                  <span className="text-body font-normal text-ink-muted"> {balance.remaining === 1 ? "day" : "days"} left</span>
                </div>
                <p className="text-helper text-ink-muted">
                  {balance.allocated} allocated
                  {balance.pending > 0 && ` · ${balance.pending} pending`}
                  {balance.used > 0 && ` · ${balance.used} used`}
                </p>
              </>
            ) : (
              <>
                <Skeleton className="h-7 w-16" />
                <Skeleton className="h-3 w-32" />
              </>
            )}
          </Card>
        );
      })}
    </div>
  );
}
