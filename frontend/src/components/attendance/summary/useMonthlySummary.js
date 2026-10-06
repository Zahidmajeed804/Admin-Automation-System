import { useEffect, useState } from "react";
import { attendanceService } from "../../../services/attendanceService";

/**
 * Loads GET /attendance/summary for `params` ({ month, userId?, designationId? }).
 * Returns { summary, loading, failed, retry }. Re-fetches whenever params change;
 * a slower earlier response never overwrites a newer one.
 */
export default function useMonthlySummary(params) {
  const [attempt, setAttempt] = useState(0);
  const requestKey = JSON.stringify([params, attempt]);
  const [result, setResult] = useState({ key: null, summary: null, failed: false });

  useEffect(() => {
    let cancelled = false;
    attendanceService
      .monthlySummary(JSON.parse(requestKey)[0])
      .then((summary) => {
        if (!cancelled) setResult({ key: requestKey, summary, failed: false });
      })
      .catch(() => {
        if (!cancelled) setResult({ key: requestKey, summary: null, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  return {
    summary: result.summary,
    loading: result.key !== requestKey,
    failed: result.key === requestKey && result.failed,
    retry: () => setAttempt((a) => a + 1),
  };
}
