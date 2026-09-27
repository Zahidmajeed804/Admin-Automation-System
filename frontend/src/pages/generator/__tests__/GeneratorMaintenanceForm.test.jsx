import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import GeneratorMaintenanceForm, { toEditValues, toPayload, toUpdatePayload } from "../GeneratorMaintenanceForm";
import { generatorService } from "../../../services/generatorService";

vi.mock("../../../services/generatorService", () => ({
  generatorService: {
    createMaintenance: vi.fn(),
    updateMaintenance: vi.fn(),
  },
}));

const GENERATOR_OPTIONS = [
  { value: "g1", label: "GEN-01" },
  { value: "g2", label: "GEN-02" },
];

const STORED_JOB = {
  _id: "j1",
  generator: { _id: "g1", tag: "GEN-01" },
  description: "Oil change",
  type: "scheduled",
  scheduledDate: "2026-03-01T00:00:00.000Z",
  intervalDays: 90,
  alertThresholdDays: 7,
  intervalHours: "",
  alertThresholdHours: "",
  hoursAtScheduling: "",
  performedBy: "Ali",
  vendor: "AutoServ",
  cost: 5000,
  partsReplaced: "Oil filter",
  notes: "",
};

describe("toEditValues", () => {
  it("maps a stored job's fields to string form values", () => {
    const values = toEditValues(STORED_JOB);
    expect(values.generatorId).toBe("g1");
    expect(values.scheduledDate).toBe("2026-03-01");
    expect(values.intervalDays).toBe("90");
    expect(values.vendor).toBe("AutoServ");
  });
});

describe("toPayload (create)", () => {
  it("omits blank optional numbers and trims text", () => {
    const payload = toPayload({
      generatorId: "g1",
      description: "  Oil change  ",
      type: "scheduled",
      scheduledDate: "2026-03-01",
      intervalDays: "90",
      alertThresholdDays: "",
      intervalHours: "",
      alertThresholdHours: "",
      hoursAtScheduling: "",
      performedBy: "",
      vendor: "  AutoServ  ",
      cost: "",
      partsReplaced: "",
      notes: "",
    });
    expect(payload).toEqual({
      generatorId: "g1",
      description: "Oil change",
      type: "scheduled",
      scheduledDate: "2026-03-01",
      intervalDays: 90,
      vendor: "AutoServ",
    });
  });
});

describe("toUpdatePayload (edit)", () => {
  it("never sends generatorId, nulls the intervals when blank, and clears blank text fields", () => {
    const payload = toUpdatePayload({
      generatorId: "g1",
      description: "Oil change",
      type: "scheduled",
      scheduledDate: "2026-03-01",
      intervalDays: "",
      alertThresholdDays: "",
      intervalHours: "",
      alertThresholdHours: "",
      hoursAtScheduling: "",
      performedBy: "",
      vendor: "",
      cost: "",
      partsReplaced: "",
      notes: "",
    });
    expect(payload.generatorId).toBeUndefined();
    expect(payload.intervalDays).toBeNull();
    expect(payload.intervalHours).toBeNull();
    expect(payload.alertThresholdDays).toBeUndefined();
    expect(payload.performedBy).toBe("");
    expect(payload.vendor).toBe("");
  });
});

describe("<GeneratorMaintenanceForm /> (create)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires generator, description and scheduled date", async () => {
    const user = userEvent.setup();
    render(<GeneratorMaintenanceForm open onClose={vi.fn()} onSaved={vi.fn()} generatorOptions={GENERATOR_OPTIONS} />);

    await user.click(screen.getByRole("button", { name: "Schedule" }));

    expect(await screen.findByText("Generator is required")).toBeInTheDocument();
    expect(screen.getByText("Description is required")).toBeInTheDocument();
    expect(screen.getByText("Scheduled date is required")).toBeInTheDocument();
    expect(generatorService.createMaintenance).not.toHaveBeenCalled();
  });

  it("rejects an interval below 1 day/hour", async () => {
    const user = userEvent.setup();
    render(<GeneratorMaintenanceForm open onClose={vi.fn()} onSaved={vi.fn()} generatorOptions={GENERATOR_OPTIONS} />);

    await user.type(screen.getByLabelText("Repeat Every (days)", { exact: false }), "0");
    await user.click(screen.getByRole("button", { name: "Schedule" }));

    expect(await screen.findByText("Interval (days) must be at least 1")).toBeInTheDocument();
  });

  it("only shows the Starting Running Hours field once an hours interval is entered", async () => {
    const user = userEvent.setup();
    render(<GeneratorMaintenanceForm open onClose={vi.fn()} onSaved={vi.fn()} generatorOptions={GENERATOR_OPTIONS} />);

    expect(screen.queryByLabelText("Starting Running Hours", { exact: false })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Repeat Every (running hours)", { exact: false }), "250");
    expect(screen.getByLabelText("Starting Running Hours", { exact: false })).toBeInTheDocument();
  });

  it("creates a job with the entered fields", async () => {
    generatorService.createMaintenance.mockResolvedValue({ _id: "new1" });
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<GeneratorMaintenanceForm open onClose={vi.fn()} onSaved={onSaved} generatorOptions={GENERATOR_OPTIONS} />);

    await user.selectOptions(screen.getByLabelText("Generator", { exact: false }), "g1");
    await user.type(screen.getByLabelText("Description", { exact: false }), "Oil change");
    await user.type(screen.getByLabelText("Scheduled Date", { exact: false }), "2026-03-01");
    await user.type(screen.getByLabelText("Vendor", { exact: false }), "AutoServ");

    await user.click(screen.getByRole("button", { name: "Schedule" }));

    await waitFor(() =>
      expect(generatorService.createMaintenance).toHaveBeenCalledWith(
        expect.objectContaining({ generatorId: "g1", description: "Oil change", scheduledDate: "2026-03-01", vendor: "AutoServ" })
      )
    );
    expect(onSaved).toHaveBeenCalledWith({ _id: "new1" });
  });

  it("preselects the given defaultGeneratorId", () => {
    render(
      <GeneratorMaintenanceForm open onClose={vi.fn()} onSaved={vi.fn()} generatorOptions={GENERATOR_OPTIONS} defaultGeneratorId="g2" />
    );
    expect(screen.getByLabelText("Generator", { exact: false })).toHaveValue("g2");
  });

  it("shows the server error inline on a failed save", async () => {
    generatorService.createMaintenance.mockRejectedValue({ response: { data: { message: "Conflict" } } });
    const user = userEvent.setup();
    render(<GeneratorMaintenanceForm open onClose={vi.fn()} onSaved={vi.fn()} generatorOptions={GENERATOR_OPTIONS} />);

    await user.selectOptions(screen.getByLabelText("Generator", { exact: false }), "g1");
    await user.type(screen.getByLabelText("Description", { exact: false }), "Oil change");
    await user.type(screen.getByLabelText("Scheduled Date", { exact: false }), "2026-03-01");
    await user.click(screen.getByRole("button", { name: "Schedule" }));

    expect(await screen.findByText("Conflict")).toBeInTheDocument();
  });
});

describe("<GeneratorMaintenanceForm /> (edit)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("pre-fills from the job and disables the generator select", () => {
    render(
      <GeneratorMaintenanceForm open onClose={vi.fn()} onSaved={vi.fn()} generatorOptions={GENERATOR_OPTIONS} job={STORED_JOB} />
    );
    expect(screen.getByRole("heading", { name: "Edit Maintenance Job" })).toBeInTheDocument();
    expect(screen.getByLabelText("Generator", { exact: false })).toBeDisabled();
    expect(screen.getByLabelText("Description", { exact: false })).toHaveValue("Oil change");
    expect(screen.getByLabelText("Repeat Every (days)", { exact: false })).toHaveValue(90);
  });

  it("saves via updateMaintenance without sending generatorId", async () => {
    generatorService.updateMaintenance.mockResolvedValue({ ...STORED_JOB, description: "Renamed" });
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(
      <GeneratorMaintenanceForm open onClose={vi.fn()} onSaved={onSaved} generatorOptions={GENERATOR_OPTIONS} job={STORED_JOB} />
    );

    const descInput = screen.getByLabelText("Description", { exact: false });
    await user.clear(descInput);
    await user.type(descInput, "Renamed");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(generatorService.updateMaintenance).toHaveBeenCalledWith(
        "j1",
        expect.objectContaining({ description: "Renamed" })
      );
      expect(generatorService.updateMaintenance.mock.calls[0][1]).not.toHaveProperty("generatorId");
    });
    expect(onSaved).toHaveBeenCalled();
  });
});
