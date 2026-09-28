import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import GeneratorReportMaintenanceCost from "../GeneratorReportMaintenanceCost";
import { generatorService } from "../../../services/generatorService";

vi.mock("../../../services/generatorService", () => ({
  generatorService: { getMaintenanceCostReport: vi.fn() },
}));

const GENERATOR_OPTIONS = [{ value: "g1", label: "GEN-01" }];

const REPORT = {
  from: "2026-03-01T00:00:00.000Z",
  to: "2026-03-31T23:59:59.999Z",
  totalCost: 5000,
  totalJobCount: 2,
  generators: [{ generator: { id: "g1", tag: "GEN-01" }, cost: 5000, jobCount: 2 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  generatorService.getMaintenanceCostReport.mockResolvedValue(REPORT);
});

describe("<GeneratorReportMaintenanceCost />", () => {
  it("shows the total-cost and completed-jobs stat cards and per-generator rows", async () => {
    render(<GeneratorReportMaintenanceCost generatorOptions={GENERATOR_OPTIONS} />);
    expect(await screen.findByText("5,000", { selector: "div.text-2xl" })).toBeInTheDocument();
    expect(screen.getByText("2", { selector: "div.text-2xl" })).toBeInTheDocument();
    expect(screen.getByText("GEN-01", { selector: "span.font-medium" })).toBeInTheDocument();
  });

  it("filters by an explicit from/to date range", async () => {
    const user = userEvent.setup();
    render(<GeneratorReportMaintenanceCost generatorOptions={GENERATOR_OPTIONS} />);
    await screen.findByText("GEN-01", { selector: "span.font-medium" });

    await user.type(screen.getByLabelText("From date"), "2026-01-01");
    await waitFor(() =>
      expect(generatorService.getMaintenanceCostReport).toHaveBeenLastCalledWith(expect.objectContaining({ from: "2026-01-01" }))
    );
  });

  it("shows the empty state when there are no generators", async () => {
    generatorService.getMaintenanceCostReport.mockResolvedValue({ ...REPORT, generators: [] });
    render(<GeneratorReportMaintenanceCost generatorOptions={GENERATOR_OPTIONS} />);
    expect(await screen.findByText("No generators to report on")).toBeInTheDocument();
  });

  it("shows an error state and retries", async () => {
    generatorService.getMaintenanceCostReport.mockRejectedValueOnce(new Error("down"));
    const user = userEvent.setup();
    render(<GeneratorReportMaintenanceCost generatorOptions={GENERATOR_OPTIONS} />);
    await waitFor(() => expect(screen.getByText(/couldn't load/i)).toBeInTheDocument());

    generatorService.getMaintenanceCostReport.mockResolvedValue(REPORT);
    await user.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(screen.getByText("GEN-01", { selector: "span.font-medium" })).toBeInTheDocument());
  });
});
