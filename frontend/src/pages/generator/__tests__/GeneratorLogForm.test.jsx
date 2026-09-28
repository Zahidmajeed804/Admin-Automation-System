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
    expect(screen.getByLabelText("Hours Run", { exact: false })).not.toBeDisabled();
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
    await user.type(screen.getByLabelText("Hours Run", { exact: false }), "8");
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
    await user.type(screen.getByLabelText("Hours Run", { exact: false }), "8");
    await user.type(screen.getByLabelText("Price per Litre", { exact: false }), "300");

    await user.click(screen.getByRole("button", { name: "Add Log" }));
    expect(await screen.findByText("Enter the litres added to use a price per litre")).toBeInTheDocument();
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
    await user.type(screen.getByLabelText("Hours Run", { exact: false }), "8");
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

  it("shows the server error inline on a failed save", async () => {
    generatorService.createLog.mockRejectedValue({ response: { data: { message: "Duplicate entry" } } });
    const user = userEvent.setup();
    render(<GeneratorLogForm open onClose={vi.fn()} onSaved={vi.fn()} generatorOptions={GENERATOR_OPTIONS} />);

    await user.selectOptions(screen.getByLabelText("Generator", { exact: false }), "g1");
    await screen.findByText(/first entry for this generator/i);
    await user.type(screen.getByLabelText("Hours Run", { exact: false }), "8");
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

    await user.type(screen.getByLabelText("Meter Reading (hours)", { exact: false }), "1208");
    expect(screen.getByLabelText("Hours Run (calculated)", { exact: false })).toHaveValue("8");
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
    await user.type(screen.getByLabelText("Meter Reading (hours)", { exact: false }), "1100");

    await user.click(screen.getByRole("button", { name: "Add Log" }));
    expect(await screen.findByText(/meter reading is lower than the last entry/i)).toBeInTheDocument();
  });

  it("submits the derived hours/opening-fuel alongside the typed reading", async () => {
    generatorService.createLog.mockResolvedValue({ _id: "new2" });
    const user = userEvent.setup();
    render(<GeneratorLogForm open onClose={vi.fn()} onSaved={vi.fn()} generatorOptions={GENERATOR_OPTIONS} />);

    await user.selectOptions(screen.getByLabelText("Generator", { exact: false }), "g1");
    await screen.findByLabelText("Hours Run (calculated)", { exact: false });
    await user.type(screen.getByLabelText("Meter Reading (hours)", { exact: false }), "1208");
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
    expect(screen.getByLabelText("Hours Run", { exact: false })).toHaveValue(8);
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

    const hoursInput = screen.getByLabelText("Hours Run", { exact: false });
    await user.clear(hoursInput);
    await user.type(hoursInput, "9");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(generatorService.updateLog).toHaveBeenCalledWith("l1", expect.objectContaining({ hoursRun: 9 }))
    );
    expect(onSaved).toHaveBeenCalled();
  });
});
