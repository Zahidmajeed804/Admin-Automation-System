import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import GeneratorForm, { toFormValues, toPayload, extractErrorMessage } from "../GeneratorForm";
import { generatorService } from "../../../services/generatorService";

vi.mock("../../../services/generatorService", () => ({
  generatorService: {
    createGenerator: vi.fn(),
    updateGenerator: vi.fn(),
  },
}));

const FULL_GENERATOR = {
  _id: "g1",
  tag: "GEN-01",
  name: "Main Hall Generator",
  location: "Roof",
  make: "Cummins",
  model: "C150",
  serialNumber: "SN-1",
  capacityKVA: 0,
  fuelType: "petrol",
  fuelTankCapacityLiters: 200,
  status: "faulty",
  installationDate: "2024-03-15T00:00:00.000Z",
  notes: "Handle with care",
};

describe("toFormValues", () => {
  it("returns blank defaults for no generator", () => {
    expect(toFormValues(null)).toEqual({
      tag: "",
      name: "",
      location: "",
      make: "",
      model: "",
      serialNumber: "",
      capacityKVA: "",
      fuelType: "diesel",
      fuelTankCapacityLiters: "",
      status: "operational",
      installationDate: "",
      notes: "",
    });
  });

  it("maps every field from a real generator, slicing the date and keeping a real 0", () => {
    const values = toFormValues(FULL_GENERATOR);
    expect(values.tag).toBe("GEN-01");
    expect(values.installationDate).toBe("2024-03-15");
    // capacityKVA: 0 is a real reading, not "unset" — must stay "0", not "".
    expect(values.capacityKVA).toBe("0");
    expect(values.fuelTankCapacityLiters).toBe("200");
    expect(values.status).toBe("faulty");
  });
});

describe("toPayload", () => {
  it("trims tag/name and omits blank optional fields", () => {
    const payload = toPayload({
      tag: "  GEN-02  ",
      name: "  Backup  ",
      location: "",
      make: "",
      model: "",
      serialNumber: "",
      notes: "",
      installationDate: "",
      capacityKVA: "",
      fuelTankCapacityLiters: "",
      fuelType: "diesel",
      status: "operational",
    });
    expect(payload).toEqual({ tag: "GEN-02", name: "Backup", fuelType: "diesel", status: "operational" });
  });

  it("includes numeric fields as numbers when present, including 0", () => {
    const payload = toPayload({
      tag: "GEN-03",
      name: "Test",
      location: "",
      make: "",
      model: "",
      serialNumber: "",
      notes: "",
      installationDate: "",
      capacityKVA: "0",
      fuelTankCapacityLiters: "500",
      fuelType: "diesel",
      status: "operational",
    });
    expect(payload.capacityKVA).toBe(0);
    expect(payload.fuelTankCapacityLiters).toBe(500);
  });
});

describe("extractErrorMessage", () => {
  it("joins an array of validation details", () => {
    const err = { response: { data: { message: "Invalid", details: [{ field: "tag", message: "Tag is required" }] } } };
    expect(extractErrorMessage(err)).toBe("Tag is required");
  });

  it("folds an object of details (e.g. duplicate key) into the message", () => {
    const err = { response: { data: { message: "Duplicate", details: { tag: "already exists" } } } };
    expect(extractErrorMessage(err)).toBe("Duplicate (tag)");
  });

  it("falls back to the plain message", () => {
    const err = { response: { data: { message: "Server error" } } };
    expect(extractErrorMessage(err)).toBe("Server error");
  });

  it("falls back to a generic message with no response payload", () => {
    expect(extractErrorMessage({})).toBe("Something went wrong. Please try again.");
  });
});

describe("<GeneratorForm />", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders blank in create mode", () => {
    render(<GeneratorForm open onClose={vi.fn()} onSaved={vi.fn()} generator={null} />);
    expect(screen.getByRole("heading", { name: "Add Generator" })).toBeInTheDocument();
    expect(screen.getByLabelText("Tag", { exact: false })).toHaveValue("");
  });

  it("pre-fills every field in edit mode", () => {
    render(<GeneratorForm open onClose={vi.fn()} onSaved={vi.fn()} generator={FULL_GENERATOR} />);
    expect(screen.getByRole("heading", { name: "Edit Generator" })).toBeInTheDocument();
    expect(screen.getByLabelText("Tag", { exact: false })).toHaveValue("GEN-01");
    expect(screen.getByLabelText("Serial Number", { exact: false })).toHaveValue("SN-1");
  });

  it("blocks submit and shows field errors when tag/name are empty", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<GeneratorForm open onClose={vi.fn()} onSaved={onSaved} generator={null} />);

    await user.click(screen.getByRole("button", { name: "Add Generator" }));

    expect(await screen.findByText("Tag is required")).toBeInTheDocument();
    expect(screen.getByText("Name is required")).toBeInTheDocument();
    expect(generatorService.createGenerator).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("creates a generator with the trimmed payload and calls onSaved", async () => {
    generatorService.createGenerator.mockResolvedValue({ _id: "new1", tag: "GEN-09" });
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<GeneratorForm open onClose={vi.fn()} onSaved={onSaved} generator={null} />);

    await user.type(screen.getByLabelText("Tag", { exact: false }), "  GEN-09  ");
    await user.type(screen.getByLabelText("Name", { exact: false }), "  New Genset  ");
    await user.click(screen.getByRole("button", { name: "Add Generator" }));

    await waitFor(() =>
      expect(generatorService.createGenerator).toHaveBeenCalledWith(
        expect.objectContaining({ tag: "GEN-09", name: "New Genset" })
      )
    );
    expect(onSaved).toHaveBeenCalledWith({ _id: "new1", tag: "GEN-09" });
  });

  it("updates the existing generator by id in edit mode", async () => {
    generatorService.updateGenerator.mockResolvedValue({ ...FULL_GENERATOR, name: "Renamed" });
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<GeneratorForm open onClose={vi.fn()} onSaved={onSaved} generator={FULL_GENERATOR} />);

    const nameInput = screen.getByLabelText("Name", { exact: false });
    await user.clear(nameInput);
    await user.type(nameInput, "Renamed");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(generatorService.updateGenerator).toHaveBeenCalledWith(
        "g1",
        expect.objectContaining({ name: "Renamed" })
      )
    );
  });

  it("shows the server error inline without calling onSaved when the save fails", async () => {
    generatorService.createGenerator.mockRejectedValue({
      response: { data: { message: "Tag already in use", details: { tag: "duplicate" } } },
    });
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<GeneratorForm open onClose={vi.fn()} onSaved={onSaved} generator={null} />);

    await user.type(screen.getByLabelText("Tag", { exact: false }), "GEN-01");
    await user.type(screen.getByLabelText("Name", { exact: false }), "Dup");
    await user.click(screen.getByRole("button", { name: "Add Generator" }));

    expect(await screen.findByText(/tag already in use/i)).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("resets to a blank form when reopened for create after being closed in edit mode", () => {
    const { rerender } = render(<GeneratorForm open onClose={vi.fn()} onSaved={vi.fn()} generator={FULL_GENERATOR} />);
    expect(screen.getByLabelText("Tag", { exact: false })).toHaveValue("GEN-01");

    rerender(<GeneratorForm open={false} onClose={vi.fn()} onSaved={vi.fn()} generator={FULL_GENERATOR} />);
    rerender(<GeneratorForm open onClose={vi.fn()} onSaved={vi.fn()} generator={null} />);

    expect(screen.getByLabelText("Tag", { exact: false })).toHaveValue("");
  });
});
