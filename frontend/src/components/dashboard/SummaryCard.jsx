import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Card from "../common/Card";
import StatCard from "../common/StatCard";
import Button from "../common/Button";
import { CardSkeleton } from "../common/Loading";

/**
 * One dashboard tile that loads its own number and links to the page behind it.
 * `load` resolves to `{ value, tone? }` where tone is StatCard's { iconColor, iconBg };
 * each tile fails and retries on its own, so one broken request doesn't blank the dashboard.
 */
export default function SummaryCard({ label, icon, to, load }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ attempt: -1, data: null, failed: false });
  const loading = state.attempt !== attempt;

  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => {
        if (!cancelled) setState({ attempt, data, failed: false });
      })
      .catch(() => {
        if (!cancelled) setState({ attempt, data: null, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [load, attempt]);

  if (loading) return <CardSkeleton />;

  if (state.failed) {
    return (
      <Card className="flex flex-col gap-3">
        <span className="text-body text-ink-secondary">{label}</span>
        <p className="text-helper text-ink-muted">Couldn't load this right now.</p>
        <div>
          <Button variant="secondary" size="sm" onClick={() => setAttempt((a) => a + 1)}>
            Try again
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Link
      to={to}
      aria-label={`${label}: ${state.data.value}`}
      className="block rounded-card transition-shadow duration-150 hover:shadow-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <StatCard label={label} value={state.data.value} icon={icon} {...state.data.tone} />
    </Link>
  );
}
