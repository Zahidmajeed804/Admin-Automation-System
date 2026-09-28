import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import GeneratorReportDieselConsumption from "../GeneratorReportDieselConsumption";
import { generatorService } from "../../../services/generatorService";

vi.mock("../../../services/generatorService", () => ({
  generatorService: { getDieselConsumptionReport: vi.fn() },
}));

const GENERATOR_OPTIONS = [{ value: "g1", label: "GEN-01" }];

const REPORT = {
  from: "2026-03-01T00:00:00.000Z",
  to: "2026-03-31T23:59:59.999Z",
  totalFuelAddedLiters: 300,
  totalFuelConsumedLiters: 250,
  generators: [{ generator: { id: "g1", tag: "GEN-01" }, fuelAddedLiters: 300, fuelConsumedLiters: 250, logCount: 3 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  generatorService.getDieselConsumptionReport.mockResolvedValue(REPORT);
});

describe("<GeneratorReportDieselConsumption />", () => {
  it("shows the fuel added/consumed stat cards and per-generator rows", async () => {
    render(<GeneratorReportDieselConsumption generatorOptions={GENERATOR_OPTIONS} />);
    expect(await screen.findByText("300 L", { selector: "div.text-2xl" })).toBeInTheDocument();
    expect(screen.getByText("250 L", { selector: "div.text-2xl" })).toBeInTheDocument();
    expect(screen.getByText("GEN-01", { selector: "span.font-medium" })).toBeInTheDocument();
  });

  it("filters by an explicit from/to date range", async () => {
    const user = userEvent.setup();
    render(<GeneratorReportDieselConsumption generatorOptions={GENERATOR_OPTIONS} />);
    await screen.findByText("GEN-01", { selector: "span.font-medium" });

    await user.type(screen.getByLabelText("From date"), "2026-01-01");
    await user.type(screen.getByLabelText("To date"), "2026-01-31");

    await waitFor(() =>
      expect(generatorService.getDieselConsumptionReport).toHaveBeenLastCalledWith(
        expect.objectContaining({ from: "2026-01-01", to: "2026-01-31" })
      )
    );
  });

  it("shows the empty state when there are no generators", async () => {
    generatorService.getDieselConsumptionReport.mockResolvedValue({ ...REPORT, generators: [] });
    render(<GeneratorReportDieselConsumption generatorOptions={GENERATOR_OPTIONS} />);
    expect(await screen.findByText("No generators to report on")).toBeInTheDocument();
  });

  it("shows an error state and retries", async () => {
    generatorService.getDieselConsumptionReport.mockRejectedValueOnce(new Error("down"));
    const user = userEvent.setup();
    render(<GeneratorReportDieselConsumption generatorOptions={GENERATOR_OPTIONS} />);
    await waitFor(() => expect(screen.getByText(/couldn't load/i)).toBeInTheDocument());

    generatorService.getDieselConsumptionReport.mockResolvedValue(REPORT);
    await user.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(screen.getByText("GEN-01", { selector: "span.font-medium" })).toBeInTheDocument());
  });
});
