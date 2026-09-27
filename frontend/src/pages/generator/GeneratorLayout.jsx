import { Outlet, useLocation, useNavigate } from "react-router-dom";
import PageHeader from "../../components/common/PageHeader";
import Tabs from "../../components/common/Tabs";
import { useAuth } from "../../context/AuthContext";

// One entry per Generator page; each tab is a real URL, so it can be
// bookmarked and the browser's back button works.
const GENERATOR_TABS = [
  { id: "registry", path: "/generator", label: "Registry" },
  { id: "logs", path: "/generator/logs", label: "Fuel & Usage Logs" },
  { id: "maintenance", path: "/generator/maintenance", label: "Maintenance" },
  // Gated on reports.read, unlike the tabs above — see the filter below.
  { id: "reports", path: "/generator/reports", label: "Reports", permission: "reports.read" },
];

/**
 * Shared frame for the Generator pages: the section heading and tab strip
 * stay mounted while the page below them changes, so keyboard focus is not
 * lost when a tab is switched. The active tab comes from the URL.
 */
export default function GeneratorLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  // Staff hold none of the generator.* permissions used to gate Registry/
  // Logs/Maintenance either (a known gap, unchanged here — see memory), so
  // this only hides Reports, which staff genuinely can't open: the route
  // itself redirects to /unauthorized on a direct hit.
  const tabs = GENERATOR_TABS.filter((tab) => !tab.permission || hasPermission(tab.permission));

  // The longest matching path wins, so "/generator/logs" doesn't also match "/generator".
  const active = [...tabs]
    .sort((a, b) => b.path.length - a.path.length)
    .find((tab) => pathname === tab.path || pathname.startsWith(`${tab.path}/`));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Generator Management" description="Track the organization's backup generators, their fuel and running hours." />
      <Tabs
        tabs={tabs}
        value={active?.id}
        onChange={(id) => navigate(tabs.find((tab) => tab.id === id).path)}
        label="Generator sections"
      />
      <Outlet />
    </div>
  );
}
