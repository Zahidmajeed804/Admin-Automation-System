import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import GeneratorMaintenanceCompleteForm from "../GeneratorMaintenanceCompleteForm";
import { generatorService } from "../../../services/generatorService";

vi.mock("../../../services/generatorService", () => ({
  generatorService: { updateMaintenance: vi.fn() },
}));

const JOB = { _id: "j1", description: "Oil change", vendor: "AutoServ" };

describe("<GeneratorMaintenanceCompleteForm />", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders nothing without a job", () => {
    const { container } = render(<GeneratorMaintenanceCompleteForm open onClose={vi.fn()} onSaved={vi.fn()} job={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the job's description and defaults completed date to today, vendor carried over", () => {
    render(<GeneratorMaintenanceCompleteForm open onClose={vi.fn()} onSaved={vi.fn()} job={JOB} />);
    expect(screen.getByText("Oil change")).toBeInTheDocument();
    const today = new Date().toISOString().slice(0, 10);
    expect(screen.getByLabelText("Completed Date", { exact: false })).toHaveValue(today);
    expect(screen.getByLabelText("Vendor", { exact: false })).toHaveValue("AutoServ");
  });

  it("rejects a negative cost or running-hours value", async () => {
    const user = userEvent.setup();
    render(<GeneratorMaintenanceCompleteForm open onClose={vi.fn()} onSaved={vi.fn()} job={JOB} />);

    await user.type(screen.getByLabelText("Cost", { exact: false }), "-5");
    await user.click(screen.getByRole("button", { name: "Mark Complete" }));
    expect(await screen.findByText("Cost must be 0 or more")).toBeInTheDocument();
    expect(generatorService.updateMaintenance).not.toHaveBeenCalled();
  });

  it("completes with only status + completedDate when nothing else is entered", async () => {
    generatorService.updateMaintenance.mockResolvedValue({ ...JOB, status: "completed" });
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<GeneratorMaintenanceCompleteForm open onClose={vi.fn()} onSaved={onSaved} job={JOB} />);

    await user.click(screen.getByRole("button", { name: "Mark Complete" }));

    await waitFor(() => expect(generatorService.updateMaintenance).toHaveBeenCalled());
    const [id, payload] = generatorService.updateMaintenance.mock.calls[0];
    expect(id).toBe("j1");
    expect(payload.status).toBe("completed");
    expect(payload).toHaveProperty("completedDate");
    expect(payload).not.toHaveProperty("hoursAtService");
    expect(payload).not.toHaveProperty("cost");
    expect(onSaved).toHaveBeenCalledWith({ ...JOB, status: "completed" });
  });

  it("includes hoursAtService, cost and technician when entered, overriding the default", async () => {
    generatorService.updateMaintenance.mockResolvedValue({});
    const user = userEvent.setup();
    render(<GeneratorMaintenanceCompleteForm open onClose={vi.fn()} onSaved={vi.fn()} job={JOB} />);

    await user.type(screen.getByLabelText("Generator's Running Hours", { exact: false }), "320");
    await user.type(screen.getByLabelText("Technician", { exact: false }), "Zain");
    await user.type(screen.getByLabelText("Cost", { exact: false }), "1500");

    await user.click(screen.getByRole("button", { name: "Mark Complete" }));

    await waitFor(() =>
      expect(generatorService.updateMaintenance).toHaveBeenCalledWith(
        "j1",
        expect.objectContaining({ hoursAtService: 320, performedBy: "Zain", cost: 1500, status: "completed" })
      )
    );
  });

  it("shows the server error inline on a failed completion", async () => {
    generatorService.updateMaintenance.mockRejectedValue({ response: { data: { message: "Already completed" } } });
    const user = userEvent.setup();
    render(<GeneratorMaintenanceCompleteForm open onClose={vi.fn()} onSaved={vi.fn()} job={JOB} />);

    await user.click(screen.getByRole("button", { name: "Mark Complete" }));
    expect(await screen.findByText("Already completed")).toBeInTheDocument();
  });

  it("resets to a fresh today-dated form when reopened for a different job", () => {
    const { rerender } = render(<GeneratorMaintenanceCompleteForm open onClose={vi.fn()} onSaved={vi.fn()} job={JOB} />);
    expect(screen.getByText("Oil change")).toBeInTheDocument();

    const OTHER_JOB = { _id: "j2", description: "Filter swap", vendor: "" };
    rerender(<GeneratorMaintenanceCompleteForm open onClose={vi.fn()} onSaved={vi.fn()} job={OTHER_JOB} />);

    expect(screen.getByText("Filter swap")).toBeInTheDocument();
    expect(screen.getByLabelText("Vendor", { exact: false })).toHaveValue("");
  });
});
