import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import GeneratorReportOperatingCost from "../GeneratorReportOperatingCost";
import { generatorService } from "../../../services/generatorService";

vi.mock("../../../services/generatorService", () => ({
  generatorService: { getOperatingCostReport: vi.fn() },
}));

const GENERATOR_OPTIONS = [{ value: "g1", label: "GEN-01" }];

// Only January has activity; the other 11 months are zeroed but still present.
const REPORT = {
  year: 2026,
  totalFuelCost: 6000,
  totalMaintenanceCost: 5000,
  totalOperatingCost: 11000,
  months: Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    fuelCost: i === 0 ? 6000 : 0,
    maintenanceCost: i === 0 ? 5000 : 0,
    operatingCost: i === 0 ? 11000 : 0,
  })),
};

beforeEach(() => {
  vi.clearAllMocks();
  generatorService.getOperatingCostReport.mockResolvedValue(REPORT);
});

describe("<GeneratorReportOperatingCost />", () => {
  it("shows the three yearly totals and a 12-month table with January and December both present", async () => {
    render(<GeneratorReportOperatingCost generatorOptions={GENERATOR_OPTIONS} />);
    expect(await screen.findByText("6,000", { selector: "div.text-2xl" })).toBeInTheDocument();
    expect(screen.getByText("5,000", { selector: "div.text-2xl" })).toBeInTheDocument();
    expect(screen.getByText("11,000", { selector: "div.text-2xl" })).toBeInTheDocument();
    expect(screen.getByText("January")).toBeInTheDocument();
    expect(screen.getByText("December")).toBeInTheDocument();
    // Every zero month still shows a real "0" row, not being hidden: 11 zero
    // months x 3 zeroed columns (fuel/maintenance/operating cost) = 33.
    expect(screen.getAllByText("0")).toHaveLength(33);
  });

  it("re-fetches with the year filter, resetting via Reset", async () => {
    const user = userEvent.setup();
    render(<GeneratorReportOperatingCost generatorOptions={GENERATOR_OPTIONS} />);
    await screen.findByText("January");

    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[1], "2025");
    await waitFor(() =>
      expect(generatorService.getOperatingCostReport).toHaveBeenLastCalledWith(expect.objectContaining({ year: "2025" }))
    );

    const resetButton = await screen.findByRole("button", { name: /reset/i });
    await user.click(resetButton);
    expect(selects[1]).toHaveValue("");
  });

  it("shows the empty state (its own copy) when there's no fuel or maintenance activity", async () => {
    generatorService.getOperatingCostReport.mockResolvedValue({ ...REPORT, months: [] });
    render(<GeneratorReportOperatingCost generatorOptions={GENERATOR_OPTIONS} />);
    expect(await screen.findByText("No data for this year")).toBeInTheDocument();
  });

  it("shows an error state and retries", async () => {
    generatorService.getOperatingCostReport.mockRejectedValueOnce(new Error("down"));
    const user = userEvent.setup();
    render(<GeneratorReportOperatingCost generatorOptions={GENERATOR_OPTIONS} />);
    await waitFor(() => expect(screen.getByText(/couldn't load/i)).toBeInTheDocument());

    generatorService.getOperatingCostReport.mockResolvedValue(REPORT);
    await user.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(screen.getByText("January")).toBeInTheDocument());
  });
});
