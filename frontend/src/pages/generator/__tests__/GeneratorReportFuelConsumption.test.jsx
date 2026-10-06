import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import GeneratorReportFuelConsumption from "../GeneratorReportFuelConsumption";
import { generatorService } from "../../../services/generatorService";
import { pickDate } from "../../../test/datePicker";

vi.mock("../../../services/generatorService", () => ({
  generatorService: { getFuelConsumptionReport: vi.fn() },
}));

const GENERATOR_OPTIONS = [{ value: "g1", label: "GEN-01" }];

const REPORT = {
  from: "2026-03-01T00:00:00.000Z",
  to: "2026-03-31T23:59:59.999Z",
  totalFuelAddedLiters: 300,
  totalFuelConsumedLiters: 250,
  totalFuelAddedKg: 0,
  totalFuelConsumedKg: 0,
  generators: [{ generator: { id: "g1", tag: "GEN-01", fuelType: "diesel" }, fuelAddedLiters: 300, fuelConsumedLiters: 250, logCount: 3 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  generatorService.getFuelConsumptionReport.mockResolvedValue(REPORT);
});

describe("<GeneratorReportFuelConsumption />", () => {
  it("shows the fuel added/consumed stat cards and per-generator rows", async () => {
    render(<GeneratorReportFuelConsumption generatorOptions={GENERATOR_OPTIONS} />);
    expect(await screen.findByText("300 L", { selector: "div.text-2xl" })).toBeInTheDocument();
    expect(screen.getByText("250 L", { selector: "div.text-2xl" })).toBeInTheDocument();
    expect(screen.getByText("GEN-01", { selector: "span.font-medium" })).toBeInTheDocument();
  });

  it("shows only kg (no bare '0 L') when the filter has only CNG generators", async () => {
    generatorService.getFuelConsumptionReport.mockResolvedValue({
      from: "2026-03-01T00:00:00.000Z",
      to: "2026-03-31T23:59:59.999Z",
      totalFuelAddedLiters: 0,
      totalFuelConsumedLiters: 0,
      totalFuelAddedKg: 80,
      totalFuelConsumedKg: 65,
      generators: [{ generator: { id: "g2", tag: "GEN-02", fuelType: "cng" }, fuelAddedLiters: 80, fuelConsumedLiters: 65, logCount: 2 }],
    });
    render(<GeneratorReportFuelConsumption generatorOptions={GENERATOR_OPTIONS} />);
    expect(await screen.findByText("80 kg", { selector: "div.text-2xl" })).toBeInTheDocument();
    expect(screen.getByText("65 kg", { selector: "div.text-2xl" })).toBeInTheDocument();
    expect(screen.queryByText(/0 L/, { selector: "div.text-2xl" })).not.toBeInTheDocument();
  });

  it("combines both units into one card for a mixed diesel+CNG filter", async () => {
    generatorService.getFuelConsumptionReport.mockResolvedValue({
      from: "2026-03-01T00:00:00.000Z",
      to: "2026-03-31T23:59:59.999Z",
      totalFuelAddedLiters: 300,
      totalFuelConsumedLiters: 250,
      totalFuelAddedKg: 80,
      totalFuelConsumedKg: 65,
      generators: [
        { generator: { id: "g1", tag: "GEN-01", fuelType: "diesel" }, fuelAddedLiters: 300, fuelConsumedLiters: 250, logCount: 3 },
        { generator: { id: "g2", tag: "GEN-02", fuelType: "cng" }, fuelAddedLiters: 80, fuelConsumedLiters: 65, logCount: 2 },
      ],
    });
    render(<GeneratorReportFuelConsumption generatorOptions={GENERATOR_OPTIONS} />);
    expect(await screen.findByText("300 L · 80 kg", { selector: "div.text-2xl" })).toBeInTheDocument();
    expect(screen.getByText("250 L · 65 kg", { selector: "div.text-2xl" })).toBeInTheDocument();
  });

  it("filters by an explicit from/to date range", async () => {
    const user = userEvent.setup();
    render(<GeneratorReportFuelConsumption generatorOptions={GENERATOR_OPTIONS} />);
    await screen.findByText("GEN-01", { selector: "span.font-medium" });

    await pickDate(user, "From", "2026-01-01");
    await pickDate(user, "To", "2026-01-31");

    await waitFor(() =>
      expect(generatorService.getFuelConsumptionReport).toHaveBeenLastCalledWith(
        expect.objectContaining({ from: "2026-01-01", to: "2026-01-31" })
      )
    );
  });

  it("shows the empty state when there are no generators", async () => {
    generatorService.getFuelConsumptionReport.mockResolvedValue({ ...REPORT, generators: [] });
    render(<GeneratorReportFuelConsumption generatorOptions={GENERATOR_OPTIONS} />);
    expect(await screen.findByText("No generators to report on")).toBeInTheDocument();
  });

  it("shows an error state and retries", async () => {
    generatorService.getFuelConsumptionReport.mockRejectedValueOnce(new Error("down"));
    const user = userEvent.setup();
    render(<GeneratorReportFuelConsumption generatorOptions={GENERATOR_OPTIONS} />);
    await waitFor(() => expect(screen.getByText(/couldn't load/i)).toBeInTheDocument());

    generatorService.getFuelConsumptionReport.mockResolvedValue(REPORT);
    await user.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(screen.getByText("GEN-01", { selector: "span.font-medium" })).toBeInTheDocument());
  });
});
