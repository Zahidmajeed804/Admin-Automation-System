import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import GeneratorLogForm, { toEditValues, toPayload, toUpdatePayload } from "../GeneratorLogForm";
import { generatorService } from "../../../services/generatorService";

vi.mock("../../../services/generatorService", () => ({
  generatorService: {
    listLogs: vi.fn(),
    createLog: vi.fn(),
    updateLog: vi.fn(),
  },
}));

const GENERATOR_OPTIONS = [
  { value: "g1", label: "GEN-01" },
  { value: "g2", label: "GEN-02" },
];

const STORED_LOG = {
  _id: "l1",
  generator: { _id: "g1", tag: "GEN-01" },
  date: "2026-02-10T00:00:00.000Z",
  hoursRun: 8,
  meterReadingHours: 1208,
  openingFuelLiters: 100,
  fuelAddedLiters: 20,
  closingFuelLiters: 115,
  fuelCostPerLiter: 300,
  fuelVendor: "Shell",
  reason: "Power outage",
  notes: "",
};

describe("toEditValues", () => {
  it("maps a stored log's fields to string form values, slicing the date", () => {
    const values = toEditValues(STORED_LOG);
    expect(values.generatorId).toBe("g1");
    expect(values.date).toBe("2026-02-10");
    expect(values.hoursRun).toBe("8");
    expect(values.closingFuelLiters).toBe("115");
    expect(values.fuelVendor).toBe("Shell");
  });

  it("leaves fuelAddedLiters blank when it's 0, not '0'", () => {
    expect(toEditValues({ ...STORED_LOG, fuelAddedLiters: 0 }).fuelAddedLiters).toBe("");
  });

  it("maps a stored gauge mark on either reading, blank when absent", () => {
    expect(toEditValues(STORED_LOG).openingFuelGaugeReading).toBe("");
    expect(toEditValues(STORED_LOG).fuelGaugeReading).toBe("");
    const withMarks = toEditValues({ ...STORED_LOG, openingFuelGaugeReading: "1/2", fuelGaugeReading: "1/4" });
    expect(withMarks.openingFuelGaugeReading).toBe("1/2");
    expect(withMarks.fuelGaugeReading).toBe("1/4");
  });
});

describe("toPayload (create)", () => {
  it("omits blank optional numbers and trims text fields", () => {
    const payload = toPayload({
      generatorId: "g1",
      date: "",
      hoursRun: "8",
      meterReadingHours: "",
      openingFuelLiters: "100",
      fuelAddedLiters: "",
      closingFuelLiters: "115",
      fuelCostPerLiter: "",
      fuelVendor: "  Shell  ",
      reason: "",
      notes: "",
    });
    expect(payload).toEqual({
      generatorId: "g1",
      hoursRun: 8,
      openingFuelLiters: 100,
      closingFuelLiters: 115,
      fuelVendor: "Shell",
    });
  });

  it("includes gauge marks when given", () => {
    const payload = toPayload({
      generatorId: "g1",
      date: "",
      hoursRun: "8",
      meterReadingHours: "",
      openingFuelLiters: "",
      openingFuelGaugeReading: "1/2",
      fuelAddedLiters: "",
      fuelGaugeReading: "1/4",
      closingFuelLiters: "50",
      fuelCostPerLiter: "",
      fuelVendor: "",
      reason: "",
      notes: "",
    });
    expect(payload).toMatchObject({ openingFuelGaugeReading: "1/2", fuelGaugeReading: "1/4" });
  });
});

describe("toUpdatePayload (edit)", () => {
  it("sends blank optional numbers/text as null so the edit clears them", () => {
    const payload = toUpdatePayload({
      hoursRun: "8",
      date: "2026-02-10",
      meterReadingHours: "",
      openingFuelLiters: "100",
      fuelAddedLiters: "",
      closingFuelLiters: "115",
      fuelCostPerLiter: "",
      fuelVendor: "",
      reason: "",
      notes: "",
    });
    expect(payload).toEqual({
      hoursRun: 8,
      date: "2026-02-10",
      meterReadingHours: null,
      openingFuelLiters: 100,
      fuelAddedLiters: null,
      closingFuelLiters: 115,
      fuelCostPerLiter: null,
      fuelVendor: null,
      reason: null,
      notes: null,
    });
  });

  it("sends a gauge mark as null when cleared, and as the mark when given", () => {
    const cleared = toUpdatePayload({
      hoursRun: "8", date: "", meterReadingHours: "", openingFuelLiters: "", openingFuelGaugeReading: "",
      fuelAddedLiters: "", fuelGaugeReading: "", closingFuelLiters: "", fuelCostPerLiter: "", fuelVendor: "", reason: "", notes: "",
    });
    expect(cleared.openingFuelGaugeReading).toBeNull();
    expect(cleared.fuelGaugeReading).toBeNull();

    const set = toUpdatePayload({
      hoursRun: "8", date: "", meterReadingHours: "", openingFuelLiters: "", openingFuelGaugeReading: "1/2",
      fuelAddedLiters: "", fuelGaugeReading: "3/4", closingFuelLiters: "", fuelCostPerLiter: "", fuelVendor: "", reason: "", notes: "",
    });
    expect(set.openingFuelGaugeReading).toBe("1/2");
    expect(set.fuelGaugeReading).toBe("3/4");
  });
});

describe("<GeneratorLogForm /> (create, no previous entry)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generatorService.listLogs.mockResolvedValue({ items: [] });
  });

  it("requires a generator before submitting", async () => {
    const user = userEvent.setup();
    render(<GeneratorLogForm open onClose={vi.fn()} onSaved={vi.fn()} generatorOptions={GENERATOR_OPTIONS} />);

    await user.click(screen.getByRole("button", { name: "Add Log" }));
    expect(await screen.findByText("Generator is required")).toBeInTheDocument();
    expect(generatorService.createLog).not.toHaveBeenCalled();
  });

  it("shows the 'first entry' note and plain (non-calculated) hours/opening-fuel inputs once a generator with no history is picked", async () => {
    const user = userEvent.setup();
    render(<GeneratorLogForm open onClose={vi.fn()} onSaved={vi.fn()} generatorOptions={GENERATOR_OPTIONS} />);

    await user.selectOptions(screen.getByLabelText("Generator", { exact: false }), "g1");
    expect(await screen.findByText(/first entry for this generator/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Hours Run — hours", { exact: false })).not.toBeDisabled();
    expect(screen.getByLabelText("Opening Fuel (L)", { exact: false })).not.toBeDisabled();
  });

  it("requires hours run to be entered when there's no previous meter reading to derive it from", async () => {
    const user = userEvent.setup();
    render(<GeneratorLogForm open onClose={vi.fn()} onSaved={vi.fn()} generatorOptions={GENERATOR_OPTIONS} />);

    await user.selectOptions(screen.getByLabelText("Generator", { exact: false }), "g1");
    await screen.findByText(/first entry for this generator/i);
    await user.click(screen.getByRole("button", { name: "Add Log" }));

    expect(await screen.findByText("Hours run is required and must be 0 or more")).toBeInTheDocument();
  });

  it("flags a fuel reading higher than the opening fuel as an error", async () => {
    const user = userEvent.setup();
    render(<GeneratorLogForm open onClose={vi.fn()} onSaved={vi.fn()} generatorOptions={GENERATOR_OPTIONS} />);

    await user.selectOptions(screen.getByLabelText("Generator", { exact: false }), "g1");
    await screen.findByText(/first entry for this generator/i);
    await user.type(screen.getByLabelText("Hours Run — hours", { exact: false }), "8");
    await user.type(screen.getByLabelText("Opening Fuel (L)", { exact: false }), "50");
    await user.type(screen.getByLabelText("Fuel Reading (L)", { exact: false }), "80");

    await user.click(screen.getByRole("button", { name: "Add Log" }));
    expect(await screen.findByText(/fuel reading is higher than the opening fuel/i, { selector: "p.text-helper" })).toBeInTheDocument();
    expect(generatorService.createLog).not.toHaveBeenCalled();
  });

  it("requires litres added before accepting a price per litre", async () => {
    const user = userEvent.setup();
    render(<GeneratorLogForm open onClose={vi.fn()} onSaved={vi.fn()} generatorOptions={GENERATOR_OPTIONS} />);

    await user.selectOptions(screen.getByLabelText("Generator", { exact: false }), "g1");
    await screen.findByText(/first entry for this generator/i);
    await user.type(screen.getByLabelText("Hours Run — hours", { exact: false }), "8");
    await user.type(screen.getByLabelText("Price per Litre", { exact: false }), "300");

    await user.click(screen.getByRole("button", { name: "Add Log" }));
    expect(await screen.findByText("Enter the L added to use a price per L")).toBeInTheDocument();
  });

  it("shows the calculated-on-save preview (consumed litres and cost) once enough figures are entered", async () => {
    const user = userEvent.setup();
    render(<GeneratorLogForm open onClose={vi.fn()} onSaved={vi.fn()} generatorOptions={GENERATOR_OPTIONS} />);

    await user.selectOptions(screen.getByLabelText("Generator", { exact: false }), "g1");
    await screen.findByText(/first entry for this generator/i);
    await user.type(screen.getByLabelText("Opening Fuel (L)", { exact: false }), "100");
    await user.type(screen.getByLabelText("Fuel Reading (L)", { exact: false }), "70");
    await user.type(screen.getByLabelText(/fuel added/i), "20");
    await user.type(screen.getByLabelText("Price per Litre", { exact: false }), "300");

    // Closing = reading(70) + added(20) = 90; consumed = opening(100) + added(20) - closing(90) = 30.
    expect(await screen.findByText(/30 L/)).toBeInTheDocument();
    expect(screen.getByText(/6,000|6000/)).toBeInTheDocument();
  });

  it("submits a first-entry log with the typed figures", async () => {
    generatorService.createLog.mockResolvedValue({ _id: "new1" });
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<GeneratorLogForm open onClose={vi.fn()} onSaved={onSaved} generatorOptions={GENERATOR_OPTIONS} />);

    await user.selectOptions(screen.getByLabelText("Generator", { exact: false }), "g1");
    await screen.findByText(/first entry for this generator/i);
    await user.type(screen.getByLabelText("Hours Run — hours", { exact: false }), "8");
    await user.type(screen.getByLabelText("Opening Fuel (L)", { exact: false }), "100");
    await user.type(screen.getByLabelText("Fuel Reading (L)", { exact: false }), "70");
    await user.type(screen.getByLabelText(/fuel added/i), "20");

    await user.click(screen.getByRole("button", { name: "Add Log" }));

    await waitFor(() =>
      expect(generatorService.createLog).toHaveBeenCalledWith(
        expect.objectContaining({ generatorId: "g1", hoursRun: 8, openingFuelLiters: 100, fuelAddedLiters: 20, closingFuelLiters: 90 })
      )
    );
    expect(onSaved).toHaveBeenCalledWith({ _id: "new1" });
  });

  it("accepts hours and minutes separately, sending the combined decimal value (20 minutes -> exactly 1/3 hour, not 0.33)", async () => {
    generatorService.createLog.mockResolvedValue({ _id: "new1" });
    const user = userEvent.setup();
    render(<GeneratorLogForm open onClose={vi.fn()} onSaved={vi.fn()} generatorOptions={GENERATOR_OPTIONS} />);

    await user.selectOptions(screen.getByLabelText("Generator", { exact: false }), "g1");
    await screen.findByText(/first entry for this generator/i);
    await user.type(screen.getByLabelText("Hours Run — hours", { exact: false }), "4");
    await user.type(screen.getByLabelText("Hours Run — minutes", { exact: false }), "20");

    await user.click(screen.getByRole("button", { name: "Add Log" }));

    await waitFor(() =>
      expect(generatorService.createLog).toHaveBeenCalledWith(expect.objectContaining({ hoursRun: 4 + 20 / 60 }))
    );
  });

  it("shows the server error inline on a failed save", async () => {
    generatorService.createLog.mockRejectedValue({ response: { data: { message: "Duplicate entry" } } });
    const user = userEvent.setup();
    render(<GeneratorLogForm open onClose={vi.fn()} onSaved={vi.fn()} generatorOptions={GENERATOR_OPTIONS} />);

    await user.selectOptions(screen.getByLabelText("Generator", { exact: false }), "g1");
    await screen.findByText(/first entry for this generator/i);
    await user.type(screen.getByLabelText("Hours Run — hours", { exact: false }), "8");
    await user.click(screen.getByRole("button", { name: "Add Log" }));

    expect(await screen.findByText("Duplicate entry")).toBeInTheDocument();
  });
});

describe("<GeneratorLogForm /> (create, with a previous entry)", () => {
  const PREV_LOG = {
    _id: "prev1",
    date: "2026-02-01T00:00:00.000Z",
    meterReadingHours: 1200,
    closingFuelLiters: 90,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    generatorService.listLogs.mockResolvedValue({ items: [PREV_LOG] });
  });

  it("derives Hours Run from the meter reading and disables direct entry", async () => {
    const user = userEvent.setup();
    render(<GeneratorLogForm open onClose={vi.fn()} onSaved={vi.fn()} generatorOptions={GENERATOR_OPTIONS} />);

    await user.selectOptions(screen.getByLabelText("Generator", { exact: false }), "g1");
    expect(await screen.findByLabelText("Hours Run (calculated)", { exact: false })).toBeDisabled();

    await user.type(screen.getByLabelText("Meter Reading (hours) — hours", { exact: false }), "1208");
    expect(screen.getByLabelText("Hours Run (calculated)", { exact: false })).toHaveValue("8h 0m");
  });

  it("derives Opening Fuel from the previous entry's closing fuel and disables direct entry", async () => {
    const user = userEvent.setup();
    render(<GeneratorLogForm open onClose={vi.fn()} onSaved={vi.fn()} generatorOptions={GENERATOR_OPTIONS} />);

    await user.selectOptions(screen.getByLabelText("Generator", { exact: false }), "g1");
    const openingInput = await screen.findByLabelText("Opening Fuel (L)", { exact: false });
    expect(openingInput).toBeDisabled();
    expect(openingInput).toHaveValue("90");
  });

  it("rejects a meter reading lower than the last entry's", async () => {
    const user = userEvent.setup();
    render(<GeneratorLogForm open onClose={vi.fn()} onSaved={vi.fn()} generatorOptions={GENERATOR_OPTIONS} />);

    await user.selectOptions(screen.getByLabelText("Generator", { exact: false }), "g1");
    await screen.findByLabelText("Hours Run (calculated)", { exact: false });
    await user.type(screen.getByLabelText("Meter Reading (hours) — hours", { exact: false }), "1100");

    await user.click(screen.getByRole("button", { name: "Add Log" }));
    expect(await screen.findByText(/meter reading is lower than the last entry/i)).toBeInTheDocument();
  });

  it("submits the derived hours/opening-fuel alongside the typed reading", async () => {
    generatorService.createLog.mockResolvedValue({ _id: "new2" });
    const user = userEvent.setup();
    render(<GeneratorLogForm open onClose={vi.fn()} onSaved={vi.fn()} generatorOptions={GENERATOR_OPTIONS} />);

    await user.selectOptions(screen.getByLabelText("Generator", { exact: false }), "g1");
    await screen.findByLabelText("Hours Run (calculated)", { exact: false });
    await user.type(screen.getByLabelText("Meter Reading (hours) — hours", { exact: false }), "1208");
    await user.type(screen.getByLabelText("Fuel Reading (L)", { exact: false }), "90");

    await user.click(screen.getByRole("button", { name: "Add Log" }));

    await waitFor(() =>
      expect(generatorService.createLog).toHaveBeenCalledWith(
        expect.objectContaining({ generatorId: "g1", hoursRun: 8, openingFuelLiters: 90, closingFuelLiters: 90, meterReadingHours: 1208 })
      )
    );
  });
});

describe("<GeneratorLogForm /> (edit)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("pre-fills from the log, disables the generator select, and skips the previous-entry lookup", () => {
    render(
      <GeneratorLogForm open onClose={vi.fn()} onSaved={vi.fn()} generatorOptions={GENERATOR_OPTIONS} log={STORED_LOG} />
    );
    expect(screen.getByRole("heading", { name: "Edit Log Entry" })).toBeInTheDocument();
    expect(screen.getByLabelText("Generator", { exact: false })).toBeDisabled();
    expect(screen.getByLabelText("Hours Run — hours", { exact: false })).toHaveValue(8);
    expect(screen.getByLabelText("Closing Fuel (L)", { exact: false })).toHaveValue(115);
    expect(generatorService.listLogs).not.toHaveBeenCalled();
  });

  it("saves via updateLog with the record's id", async () => {
    generatorService.updateLog.mockResolvedValue({ ...STORED_LOG, hoursRun: 9 });
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(
      <GeneratorLogForm open onClose={vi.fn()} onSaved={onSaved} generatorOptions={GENERATOR_OPTIONS} log={STORED_LOG} />
    );

    const hoursInput = screen.getByLabelText("Hours Run — hours", { exact: false });
    await user.clear(hoursInput);
    await user.type(hoursInput, "9");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(generatorService.updateLog).toHaveBeenCalledWith("l1", expect.objectContaining({ hoursRun: 9 }))
    );
    expect(onSaved).toHaveBeenCalled();
  });
});

const GAUGE_OPTIONS = [{ value: "g1", label: "GEN-01", fuelMeasurementType: "gauge", fuelTankCapacityLiters: 200 }];
const GAUGE_OPTIONS_NO_CAPACITY = [{ value: "g1", label: "GEN-01", fuelMeasurementType: "gauge", fuelTankCapacityLiters: undefined }];

describe("<GeneratorLogForm /> (create, gauge generator, no previous entry)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generatorService.listLogs.mockResolvedValue({ items: [] });
  });

  it("shows gauge-mark selects for opening and reading instead of free number inputs", async () => {
    const user = userEvent.setup();
    render(<GeneratorLogForm open onClose={vi.fn()} onSaved={vi.fn()} generatorOptions={GAUGE_OPTIONS} />);

    await user.selectOptions(screen.getByLabelText("Generator", { exact: false }), "g1");
    await screen.findByText(/first entry for this generator/i);

    expect(screen.getByLabelText("Opening Fuel (gauge)", { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText("Fuel Reading (gauge)", { exact: false })).toBeInTheDocument();
    expect(screen.queryByLabelText("Opening Fuel (L)", { exact: false })).not.toBeInTheDocument();
  });

  it("converts the selected marks to an estimated closing fuel and does not block a higher reading", async () => {
    const user = userEvent.setup();
    render(<GeneratorLogForm open onClose={vi.fn()} onSaved={vi.fn()} generatorOptions={GAUGE_OPTIONS} />);

    await user.selectOptions(screen.getByLabelText("Generator", { exact: false }), "g1");
    await screen.findByText(/first entry for this generator/i);
    await user.type(screen.getByLabelText("Hours Run — hours", { exact: false }), "8");
    await user.selectOptions(screen.getByLabelText("Opening Fuel (gauge)", { exact: false }), "1/4"); // 50 L
    await user.selectOptions(screen.getByLabelText("Fuel Reading (gauge)", { exact: false }), "F"); // 200 L, above opening

    // Estimated closing (≈ 200 L) is shown, but submitting is not blocked by it.
    expect(await screen.findByText(/≈ 200/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add Log" }));
    await waitFor(() => expect(generatorService.createLog).toHaveBeenCalled());
  });

  it("submits the converted litres alongside the chosen marks", async () => {
    generatorService.createLog.mockResolvedValue({ _id: "new3" });
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<GeneratorLogForm open onClose={vi.fn()} onSaved={onSaved} generatorOptions={GAUGE_OPTIONS} />);

    await user.selectOptions(screen.getByLabelText("Generator", { exact: false }), "g1");
    await screen.findByText(/first entry for this generator/i);
    await user.type(screen.getByLabelText("Hours Run — hours", { exact: false }), "8");
    await user.selectOptions(screen.getByLabelText("Opening Fuel (gauge)", { exact: false }), "1/2"); // 100 L
    await user.selectOptions(screen.getByLabelText("Fuel Reading (gauge)", { exact: false }), "1/4"); // 50 L
    await user.type(screen.getByLabelText(/fuel added/i), "20");

    await user.click(screen.getByRole("button", { name: "Add Log" }));

    await waitFor(() =>
      expect(generatorService.createLog).toHaveBeenCalledWith(
        expect.objectContaining({
          generatorId: "g1",
          openingFuelGaugeReading: "1/2",
          openingFuelLiters: 100,
          fuelGaugeReading: "1/4",
          fuelAddedLiters: 20,
          closingFuelLiters: 70, // 50 (reading) + 20 (added)
        })
      )
    );
    expect(onSaved).toHaveBeenCalledWith({ _id: "new3" });
  });

  it("disables fuel-level entry and shows a notice when the generator has no tank capacity", async () => {
    const user = userEvent.setup();
    render(<GeneratorLogForm open onClose={vi.fn()} onSaved={vi.fn()} generatorOptions={GAUGE_OPTIONS_NO_CAPACITY} />);

    await user.selectOptions(screen.getByLabelText("Generator", { exact: false }), "g1");
    await screen.findByText(/first entry for this generator/i);

    expect(await screen.findByText(/no tank capacity set/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Opening Fuel (gauge)", { exact: false })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Fuel Reading (gauge)", { exact: false })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Opening Fuel (L)", { exact: false })).toBeDisabled();
    expect(screen.getByLabelText("Fuel Reading (L)", { exact: false })).toBeDisabled();
  });

  it("still lets hours run be logged when fuel-level entry is disabled for a missing capacity", async () => {
    generatorService.createLog.mockResolvedValue({ _id: "new4" });
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<GeneratorLogForm open onClose={vi.fn()} onSaved={onSaved} generatorOptions={GAUGE_OPTIONS_NO_CAPACITY} />);

    await user.selectOptions(screen.getByLabelText("Generator", { exact: false }), "g1");
    await screen.findByText(/first entry for this generator/i);
    await user.type(screen.getByLabelText("Hours Run — hours", { exact: false }), "5");
    await user.click(screen.getByRole("button", { name: "Add Log" }));

    await waitFor(() =>
      expect(generatorService.createLog).toHaveBeenCalledWith(expect.objectContaining({ generatorId: "g1", hoursRun: 5 }))
    );
    expect(onSaved).toHaveBeenCalledWith({ _id: "new4" });
  });
});

describe("<GeneratorLogForm /> (create, gauge generator, with a previous entry)", () => {
  const PREV_LOG = { _id: "prev1", date: "2026-02-01T00:00:00.000Z", meterReadingHours: 1200, closingFuelLiters: 90 };

  beforeEach(() => {
    vi.clearAllMocks();
    generatorService.listLogs.mockResolvedValue({ items: [PREV_LOG] });
  });

  it("keeps opening fuel auto-filled from the previous entry, and shows only a reading gauge select", async () => {
    const user = userEvent.setup();
    render(<GeneratorLogForm open onClose={vi.fn()} onSaved={vi.fn()} generatorOptions={GAUGE_OPTIONS} />);

    await user.selectOptions(screen.getByLabelText("Generator", { exact: false }), "g1");
    const openingInput = await screen.findByLabelText("Opening Fuel (L)", { exact: false });
    expect(openingInput).toBeDisabled();
    expect(openingInput).toHaveValue("90");
    expect(screen.getByLabelText("Fuel Reading (gauge)", { exact: false })).toBeInTheDocument();
    expect(screen.queryByLabelText("Opening Fuel (gauge)", { exact: false })).not.toBeInTheDocument();
  });
});

describe("<GeneratorLogForm /> (edit, gauge generator)", () => {
  beforeEach(() => vi.clearAllMocks());

  const GAUGE_GENERATOR = { _id: "g1", tag: "GEN-01", fuelMeasurementType: "gauge", fuelTankCapacityLiters: 200 };

  it("shows a prefilled gauge select when the entry has a stored mark", () => {
    const log = { ...STORED_LOG, generator: GAUGE_GENERATOR, fuelGaugeReading: "1/4" };
    render(<GeneratorLogForm open onClose={vi.fn()} onSaved={vi.fn()} generatorOptions={GAUGE_OPTIONS} log={log} />);

    expect(screen.getByLabelText("Fuel Reading (gauge)", { exact: false })).toHaveValue("1/4");
  });

  it("falls back to the free closing-fuel number input for a legacy entry with no stored mark", () => {
    const log = { ...STORED_LOG, generator: GAUGE_GENERATOR };
    render(<GeneratorLogForm open onClose={vi.fn()} onSaved={vi.fn()} generatorOptions={GAUGE_OPTIONS} log={log} />);

    expect(screen.queryByLabelText("Fuel Reading (gauge)", { exact: false })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Closing Fuel (L)", { exact: false })).toHaveValue(115);
  });

  it("saves a changed gauge mark converted to litres", async () => {
    generatorService.updateLog.mockResolvedValue({ ...STORED_LOG, fuelGaugeReading: "3/4" });
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const log = { ...STORED_LOG, generator: GAUGE_GENERATOR, fuelGaugeReading: "1/4" };
    render(<GeneratorLogForm open onClose={vi.fn()} onSaved={onSaved} generatorOptions={GAUGE_OPTIONS} log={log} />);

    await user.selectOptions(screen.getByLabelText("Fuel Reading (gauge)", { exact: false }), "3/4");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(generatorService.updateLog).toHaveBeenCalledWith(
        "l1",
        expect.objectContaining({ fuelGaugeReading: "3/4", closingFuelLiters: 170 }) // 150 (3/4 of 200) + 20 added
      )
    );
    expect(onSaved).toHaveBeenCalled();
  });
});
