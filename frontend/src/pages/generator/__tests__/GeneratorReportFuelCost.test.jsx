import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import GeneratorReportFuelCost from "../GeneratorReportFuelCost";
import { generatorService } from "../../../services/generatorService";

vi.mock("../../../services/generatorService", () => ({
  generatorService: { getFuelCostReport: vi.fn() },
}));

const GENERATOR_OPTIONS = [{ value: "g1", label: "GEN-01" }];

const REPORT = {
  month: 3,
  year: 2026,
  totalFuelCost: 90000,
  averageCostPerLiter: 300,
  generators: [
    { generator: { id: "g1", tag: "GEN-01" }, fuelCostTotal: 90000, fuelAddedLiters: 300, averageCostPerLiter: 300, logCount: 3 },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  generatorService.getFuelCostReport.mockResolvedValue(REPORT);
});

describe("<GeneratorReportFuelCost />", () => {
  it("shows the total-cost and average-cost stat cards and per-generator rows", async () => {
    render(<GeneratorReportFuelCost generatorOptions={GENERATOR_OPTIONS} />);
    expect(await screen.findByText("90,000", { selector: "div.text-2xl" })).toBeInTheDocument();
    expect(screen.getByText("300", { selector: "div.text-2xl" })).toBeInTheDocument();
    expect(screen.getByText("GEN-01", { selector: "span.font-medium" })).toBeInTheDocument();
  });

  it("re-fetches when the month filter changes", async () => {
    const user = userEvent.setup();
    render(<GeneratorReportFuelCost generatorOptions={GENERATOR_OPTIONS} />);
    await screen.findByText("GEN-01", { selector: "span.font-medium" });

    await user.type(screen.getByLabelText("Month"), "2026-01");
    await waitFor(() =>
      expect(generatorService.getFuelCostReport).toHaveBeenLastCalledWith(expect.objectContaining({ month: "2026-01" }))
    );
  });

  it("shows the empty state when there are no generators", async () => {
    generatorService.getFuelCostReport.mockResolvedValue({ ...REPORT, generators: [] });
    render(<GeneratorReportFuelCost generatorOptions={GENERATOR_OPTIONS} />);
    expect(await screen.findByText("No generators to report on")).toBeInTheDocument();
  });

  it("shows an error state and retries", async () => {
    generatorService.getFuelCostReport.mockRejectedValueOnce(new Error("down"));
    const user = userEvent.setup();
    render(<GeneratorReportFuelCost generatorOptions={GENERATOR_OPTIONS} />);
    await waitFor(() => expect(screen.getByText(/couldn't load/i)).toBeInTheDocument());

    generatorService.getFuelCostReport.mockResolvedValue(REPORT);
    await user.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(screen.getByText("GEN-01", { selector: "span.font-medium" })).toBeInTheDocument());
  });
});
