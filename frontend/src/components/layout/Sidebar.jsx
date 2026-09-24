import { NavLink } from "react-router-dom";
import { ShieldCheck, X } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "../../context/AuthContext";
import { navSections } from "../../constants/navigation";

/**
 * Desktop sidebar + mobile drawer (controlled by `open`/`onClose`).
 * Same component renders both — only the wrapping classes differ by breakpoint.
 */
export default function Sidebar({ open, onClose }) {
  const { hasPermission } = useAuth();
  const content = (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-border flex-shrink-0">
        <span className="h-9 w-9 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="h-5 w-5 text-white" />
        </span>
        <div className="leading-tight">
          <p className="text-card-heading text-ink">Admin Automation</p>
          <p className="text-helper text-ink-muted">System</p>
        </div>
        <button
          onClick={onClose}
          className="ml-auto lg:hidden h-8 w-8 rounded-md flex items-center justify-center text-ink-muted hover:bg-surface-subtle"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-5">
        {navSections.map((section, i) => (
          <div key={i} className="flex flex-col gap-1">
            {section.label && (
              <p className="px-3 mb-1 text-helper font-semibold text-ink-muted tracking-wide">
                {section.label}
              </p>
            )}
            {section.items.filter((item) => !item.permission || hasPermission(item.permission)).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onClose}
                className={({ isActive }) =>
                  clsx(
                    "flex items-center gap-3 px-3 h-10 rounded-md text-body font-medium transition-colors duration-150",
                    isActive
                      ? "bg-surface-blue text-primary"
                      : "text-ink-secondary hover:bg-surface-subtle hover:text-ink"
                  )
                }
              >
                <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:block w-[260px] flex-shrink-0 border-r border-border h-screen sticky top-0">
        {content}
      </aside>

      {/* Mobile drawer */}
      <div className={clsx("lg:hidden fixed inset-0 z-40", open ? "pointer-events-auto" : "pointer-events-none")}>
        <div
          className={clsx(
            "absolute inset-0 bg-slate-900/40 transition-opacity duration-150",
            open ? "opacity-100" : "opacity-0"
          )}
          onClick={onClose}
        />
        <div
          className={clsx(
            "absolute left-0 top-0 h-full w-[260px] shadow-elevated transition-transform duration-150",
            open ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {content}
        </div>
      </div>
    </>
  );
}
