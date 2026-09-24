import PageHeader from "./PageHeader";
import Card from "./Card";
import { Construction } from "lucide-react";

/**
 * Temporary placeholder for a module page that hasn't been built yet.
 * Each module replaces its ComingSoon usage with real content when it's
 * implemented — this only exists to prove routing/layout end-to-end in
 * Phase 0.
 */
export default function ComingSoon({ title, moduleLabel }) {
  return (
    <>
      <PageHeader title={title} description={`This module will be implemented in ${moduleLabel}.`} />
      <Card className="flex flex-col items-center justify-center text-center gap-3 py-16">
        <span className="h-12 w-12 rounded-full bg-surface-blue flex items-center justify-center">
          <Construction className="h-6 w-6 text-primary" />
        </span>
        <p className="text-card-heading text-ink"></p>
        <p className="text-body text-ink-muted max-w-sm">
          The layout, navigation, and design system are ready. This screen will be built out in {moduleLabel}.
        </p>
      </Card>
    </>
  );
}
