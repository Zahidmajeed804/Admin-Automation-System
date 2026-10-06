import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import GeneratorReportsPage from "../GeneratorReportsPage";
import { generatorService } from "../../../services/generatorService";

vi.mock("../../../services/generatorService", () => ({
  generatorService: { listGenerators: vi.fn() },
}));

// Every report view has its own dedicated test file; here they're stubbed to
// a label plus the generatorOptions they were handed, so this file can focus
// purely on GeneratorReportsPage's own job: tab switching and fetching the
// shared generator-options dropdown once for every panel to reuse.
vi.mock("../GeneratorReportRunningHours", () => ({
  default: ({ generatorOptions }) => <div>Running Hours view ({generatorOptions.length} generators)</div>,
}));
vi.mock("../GeneratorReportFuelConsumption", () => ({
  default: () => <div>Fuel Consumption view</div>,
}));
vi.mock("../GeneratorReportFuelCost", () => ({ default: () => <div>Fuel Cost view</div> }));
vi.mock("../GeneratorReportMaintenanceCost", () => ({ default: () => <div>Maintenance Cost view</div> }));
vi.mock("../GeneratorReportOperatingCost", () => ({ default: () => <div>Operating Cost view</div> }));
vi.mock("../GeneratorReportServiceHistory", () => ({ default: () => <div>Service History view</div> }));
vi.mock("../GeneratorReportCostAnalysis", () => ({ default: () => <div>Cost Analysis view</div> }));

beforeEach(() => {
  vi.clearAllMocks();
  generatorService.listGenerators.mockResolvedValue({
    items: [{ _id: "g1", tag: "GEN-01" }, { _id: "g2", tag: "GEN-02" }],
    meta: {},
  });
});

describe("GeneratorReportsPage", () => {
  it("shows all seven spec 4.2 report tabs, Running Hours first and Cost Analysis last", () => {
    render(<GeneratorReportsPage />);
    const tabs = screen.getAllByRole("tab").map((t) => t.textContent);
    expect(tabs).toEqual([
      "Running Hours",
      "Fuel Consumption",
      "Fuel Cost",
      "Maintenance Cost",
      "Operating Cost",
      "Service History",
      "Cost Analysis",
    ]);
  });

  it("renders the Running Hours panel by default", async () => {
    render(<GeneratorReportsPage />);
    expect(await screen.findByText(/running hours view/i)).toBeInTheDocument();
  });

  it("fetches the generator options once and hands them down to the active panel", async () => {
    render(<GeneratorReportsPage />);
    expect(await screen.findByText("Running Hours view (2 generators)")).toBeInTheDocument();
    expect(generatorService.listGenerators).toHaveBeenCalledTimes(1);
  });

  it("switches panels when a different tab is clicked, without re-fetching generator options", async () => {
    const user = userEvent.setup();
    render(<GeneratorReportsPage />);
    await screen.findByText(/running hours view/i);

    await user.click(screen.getByRole("tab", { name: "Cost Analysis" }));
    expect(screen.getByText("Cost Analysis view")).toBeInTheDocument();
    expect(screen.queryByText(/running hours view/i)).not.toBeInTheDocument();
    expect(generatorService.listGenerators).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("tab", { name: "Service History" }));
    expect(screen.getByText("Service History view")).toBeInTheDocument();
  });

  it("leaves the generator options dropdown empty (no crash) if the fetch fails", async () => {
    generatorService.listGenerators.mockRejectedValue(new Error("down"));
    render(<GeneratorReportsPage />);
    await waitFor(() => expect(screen.getByText("Running Hours view (0 generators)")).toBeInTheDocument());
  });
});
