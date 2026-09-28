import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import GeneratorReportCostAnalysis from "../GeneratorReportCostAnalysis";
import { generatorService } from "../../../services/generatorService";

vi.mock("../../../services/generatorService", () => ({
  generatorService: {
    getOperatingCostReport: vi.fn(),
    getCostSummaryReport: vi.fn(),
    getDieselConsumptionReport: vi.fn(),
  },
}));

// recharts' <ResponsiveContainer> needs a real ResizeObserver and layout to
// paint anything, neither of which jsdom provides, so its charts render as
// empty containers here — a known limitation, not something this file works
// around. What IS testable without a browser: the totals row, the loading/
// error/empty gating, the chart section headings (plain text, not chart
// internals), and that the three report fetches are wired to the filters
// correctly. Chart-content correctness was covered by AAS-371's real
// end-to-end browser run against the actual dev database (S2.13).

const GENERATOR_OPTIONS = [{ value: "g1", label: "GEN-01" }];

const OPERATING = {
  year: 2026,
  totalFuelCost: 6000,
  totalMaintenanceCost: 5000,
  totalOperatingCost: 11000,
  months: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, fuelCost: 0, maintenanceCost: 0, operatingCost: 0 })),
};
const COST_SUMMARY = { generators: [{ generator: { tag: "GEN-01" }, fuelCost: 6000, maintenanceCost: 5000 }] };
const DIESEL = { generators: [{ generator: { tag: "GEN-01" }, fuelAddedLiters: 100, fuelConsumedLiters: 80 }] };

function mockAllReports() {
  generatorService.getOperatingCostReport.mockResolvedValue(OPERATING);
  generatorService.getCostSummaryReport.mockResolvedValue(COST_SUMMARY);
  generatorService.getDieselConsumptionReport.mockResolvedValue(DIESEL);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAllReports();
});

describe("<GeneratorReportCostAnalysis />", () => {
  it("shows the three cost totals and the three chart section headings once loaded", async () => {
    render(<GeneratorReportCostAnalysis generatorOptions={GENERATOR_OPTIONS} />);
    expect(await screen.findByText("6,000", { selector: "div.text-2xl" })).toBeInTheDocument();
    expect(screen.getByText("5,000", { selector: "div.text-2xl" })).toBeInTheDocument();
    expect(screen.getByText("11,000", { selector: "div.text-2xl" })).toBeInTheDocument();
    expect(screen.getByText("Monthly Cost Trend — 2026")).toBeInTheDocument();
    expect(screen.getByText("Cost by Generator — 2026")).toBeInTheDocument();
    expect(screen.getByText("Fuel Consumption by Generator — 2026")).toBeInTheDocument();
  });

  it("shows a loading state, then the content", async () => {
    let resolveOperating;
    generatorService.getOperatingCostReport.mockReturnValue(new Promise((res) => (resolveOperating = res)));
    render(<GeneratorReportCostAnalysis generatorOptions={GENERATOR_OPTIONS} />);

    expect(screen.getByText(/loading cost analysis/i)).toBeInTheDocument();
    resolveOperating(OPERATING);
    await waitFor(() => expect(screen.queryByText(/loading cost analysis/i)).not.toBeInTheDocument());
  });

  it("scopes the cost-summary and diesel-consumption fetches to the same calendar year as the operating-cost year", async () => {
    render(<GeneratorReportCostAnalysis generatorOptions={GENERATOR_OPTIONS} />);
    await waitFor(() => expect(generatorService.getOperatingCostReport).toHaveBeenCalled());

    const currentYear = new Date().getUTCFullYear();
    expect(generatorService.getCostSummaryReport).toHaveBeenCalledWith(
      expect.objectContaining({ from: `${currentYear}-01-01`, to: `${currentYear}-12-31T23:59:59.999Z` })
    );
    expect(generatorService.getDieselConsumptionReport).toHaveBeenCalledWith(
      expect.objectContaining({ from: `${currentYear}-01-01`, to: `${currentYear}-12-31T23:59:59.999Z` })
    );
  });

  it("re-fetches all three reports scoped to the chosen generator and year", async () => {
    const user = userEvent.setup();
    render(<GeneratorReportCostAnalysis generatorOptions={GENERATOR_OPTIONS} />);
    await screen.findByText("Monthly Cost Trend — 2026");

    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[0], "g1");
    await user.selectOptions(selects[1], "2025");

    await waitFor(() => {
      expect(generatorService.getOperatingCostReport).toHaveBeenLastCalledWith({ generatorId: "g1", year: "2025" });
      expect(generatorService.getCostSummaryReport).toHaveBeenLastCalledWith(
        expect.objectContaining({ generatorId: "g1", from: "2025-01-01", to: "2025-12-31T23:59:59.999Z" })
      );
      expect(generatorService.getDieselConsumptionReport).toHaveBeenLastCalledWith(
        expect.objectContaining({ generatorId: "g1", from: "2025-01-01", to: "2025-12-31T23:59:59.999Z" })
      );
    });
  });

  it("shows Reset once filtered and clears back to the default filter", async () => {
    const user = userEvent.setup();
    render(<GeneratorReportCostAnalysis generatorOptions={GENERATOR_OPTIONS} />);
    await screen.findByText("Monthly Cost Trend — 2026");

    await user.selectOptions(screen.getAllByRole("combobox")[0], "g1");
    const resetButton = await screen.findByRole("button", { name: /reset/i });
    await user.click(resetButton);

    expect(screen.getAllByRole("combobox")[0]).toHaveValue("");
  });

  it("gates the whole page on an operating-cost failure, with a working retry", async () => {
    generatorService.getOperatingCostReport.mockRejectedValueOnce(new Error("down"));
    const user = userEvent.setup();
    render(<GeneratorReportCostAnalysis generatorOptions={GENERATOR_OPTIONS} />);

    expect(await screen.findByText(/couldn't load the cost-analysis dashboard/i)).toBeInTheDocument();
    expect(screen.queryByText(/monthly cost trend/i)).not.toBeInTheDocument();

    mockAllReports();
    await user.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(screen.getByText("Monthly Cost Trend — 2026")).toBeInTheDocument());
  });

  it("degrades only its own chart, not the whole page, when diesel-consumption fails alone", async () => {
    generatorService.getDieselConsumptionReport.mockRejectedValueOnce(new Error("down"));
    render(<GeneratorReportCostAnalysis generatorOptions={GENERATOR_OPTIONS} />);

    // Totals, trend and the cost-by-generator chart (none of which depend on
    // diesel-consumption) still render normally; no page-wide error banner.
    expect(await screen.findByText("11,000", { selector: "div.text-2xl" })).toBeInTheDocument();
    expect(screen.getByText("Cost by Generator — 2026")).toBeInTheDocument();
    expect(screen.getByText("Fuel Consumption by Generator — 2026")).toBeInTheDocument();
    expect(screen.queryByText(/couldn't load the cost-analysis dashboard/i)).not.toBeInTheDocument();
  });

  // Real behavior found while writing this test (not a crash, but worth
  // flagging): `isEmpty` is derived only from cost-summary's own generator
  // count (`costSummary?.generators.length ?? 0`), so a cost-summary fetch
  // failure (costSummary stays null) reads as "zero generators" and shows
  // the empty state instead of a page still gated by a real error. This
  // shipped as part of S2.13 and wasn't caught by AAS-371's verification,
  // which only exercised loading/error/empty individually, never a
  // cost-summary failure specifically. Documented here rather than "fixed"
  // silently, since deciding the right behavior (a dedicated warning banner
  // vs. reusing the page error) is a product call, not a test-writing one.
  it("shows the empty state (misleadingly) rather than an error when cost-summary alone fails to load", async () => {
    generatorService.getCostSummaryReport.mockRejectedValueOnce(new Error("down"));
    render(<GeneratorReportCostAnalysis generatorOptions={GENERATOR_OPTIONS} />);

    expect(await screen.findByText("No generators to report on")).toBeInTheDocument();
    expect(screen.queryByText(/couldn't load the cost-analysis dashboard/i)).not.toBeInTheDocument();
  });

  it("shows the empty state only when the fleet has zero active generators, not merely zero activity", async () => {
    generatorService.getCostSummaryReport.mockResolvedValue({ generators: [] });
    render(<GeneratorReportCostAnalysis generatorOptions={GENERATOR_OPTIONS} />);
    expect(await screen.findByText("No generators to report on")).toBeInTheDocument();
    // The totals row (built from operating-cost, not cost-summary) is not shown alongside the empty state.
    expect(screen.queryByText("Monthly Cost Trend — 2026")).not.toBeInTheDocument();
  });
});
