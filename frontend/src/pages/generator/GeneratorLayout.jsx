import { Outlet, useLocation, useNavigate } from "react-router-dom";
import PageHeader from "../../components/common/PageHeader";
import Tabs from "../../components/common/Tabs";

// One entry per Generator page; each tab is a real URL, so it can be
// bookmarked and the browser's back button works. Maintenance and Reports
// get added here when those pages are built.
const GENERATOR_TABS = [
  { value: "/generator", label: "Registry" },
  { value: "/generator/logs", label: "Fuel & Usage Logs" },
];

/**
 * Shared frame for the Generator pages: the section heading and tab strip
 * stay mounted while the page below them changes, so keyboard focus is not
 * lost when a tab is switched. The active tab comes from the URL.
 */
export default function GeneratorLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  // The longest matching path wins, so "/generator/logs" doesn't also match "/generator".
  const active = [...GENERATOR_TABS]
    .sort((a, b) => b.value.length - a.value.length)
    .find((tab) => pathname === tab.value || pathname.startsWith(`${tab.value}/`));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Generator Management" description="Track the organization's backup generators, their fuel and running hours." />
      <Tabs tabs={GENERATOR_TABS} value={active?.value} onChange={navigate} />
      <Outlet />
    </div>
  );
}
