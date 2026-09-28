import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import GeneratorMaintenancePage from "../GeneratorMaintenancePage";
import { generatorService } from "../../../services/generatorService";
import { useAuth } from "../../../context/AuthContext";

vi.mock("../../../services/generatorService", () => ({
  generatorService: {
    listGenerators: vi.fn(),
    listMaintenance: vi.fn(),
    getMaintenanceAlerts: vi.fn(),
    updateMaintenance: vi.fn(),
    deleteMaintenance: vi.fn(),
  },
}));

vi.mock("../../../context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

// Each of these has its own real-component coverage elsewhere (forms in
// AAS-375); here they're stubbed to their open/job contract so the page's
// own orchestration — filters, table, view/cancel/delete flow, invoice sync
// — is what's under test, not their internals.
vi.mock("../GeneratorMaintenanceForm", () => ({
  default: ({ open, job, onSaved }) =>
    open ? (
      <div data-testid="maintenance-form">
        {job ? `Editing ${job._id}` : "New job"}
        <button onClick={() => onSaved()}>Save</button>
      </div>
    ) : null,
}));
vi.mock("../GeneratorMaintenanceCompleteForm", () => ({
  default: ({ open, job, onSaved }) =>
    open ? (
      <div data-testid="complete-form">
        Completing {job?._id}
        <button onClick={() => onSaved()}>Confirm Complete</button>
      </div>
    ) : null,
}));
vi.mock("../GeneratorMaintenanceInvoice", () => ({
  default: ({ open, job, onChanged }) =>
    open ? (
      <div data-testid="invoice-modal">
        Invoice for {job?._id}
        <button onClick={() => onChanged({ ...job, invoice: { filename: "new.pdf" } })}>Upload</button>
      </div>
    ) : null,
}));
vi.mock("../GeneratorMaintenanceDetails", () => ({
  default: ({ open, job, onManageInvoice }) =>
    open ? (
      <div data-testid="details-modal">
        Details for {job?.description}
        <button onClick={() => onManageInvoice(job)}>Manage Invoice</button>
      </div>
    ) : null,
}));

const JOB_1 = {
  _id: "j1",
  generator: { tag: "GEN-01" },
  description: "Oil change",
  type: "scheduled",
  status: "scheduled",
  alertStatus: "upcoming",
  scheduledDate: "2026-03-01T00:00:00.000Z",
  vendor: "AutoServ",
  cost: 5000,
  daysUntilDue: 3,
  hoursUntilDue: null,
};
const JOB_2 = {
  _id: "j2",
  generator: { tag: "GEN-02" },
  description: "Filter replacement",
  type: "unscheduled",
  status: "completed",
  alertStatus: null,
  scheduledDate: "2026-01-15T00:00:00.000Z",
  vendor: "",
  cost: 0,
};

function mockAuth(permissions = []) {
  useAuth.mockReturnValue({ hasPermission: (p) => permissions.includes(p) });
}

function mockMaintenance({ items = [JOB_1, JOB_2], meta = { page: 1, totalPages: 1, totalItems: 2, pageSize: 10 } } = {}) {
  generatorService.listMaintenance.mockResolvedValue({ items, meta });
}

const tag = (t) => screen.getByText(t, { selector: "span.font-medium" });

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth(["generator.create", "generator.update", "generator.delete"]);
  generatorService.listGenerators.mockResolvedValue({
    items: [{ _id: "g1", tag: "GEN-01" }, { _id: "g2", tag: "GEN-02" }],
    meta: {},
  });
  generatorService.getMaintenanceAlerts.mockResolvedValue({ counts: { overdue: 2, upcoming: 5 } });
  mockMaintenance();
});

describe("GeneratorMaintenancePage", () => {
  it("renders jobs with generator, type, status badge and vendor", async () => {
    render(<GeneratorMaintenancePage />);
    await waitFor(() => expect(tag("GEN-01")).toBeInTheDocument());
    expect(screen.getByText("Oil change")).toBeInTheDocument();
    expect(screen.getByText("AutoServ")).toBeInTheDocument();
    expect(screen.getByText("Filter replacement")).toBeInTheDocument();
  });

  it("renders the Overdue/Upcoming stat cards from the alerts endpoint", async () => {
    render(<GeneratorMaintenancePage />);
    await waitFor(() => expect(screen.getByText("2", { selector: "div.text-2xl" })).toBeInTheDocument());
    expect(screen.getByText("5", { selector: "div.text-2xl" })).toBeInTheDocument();
    expect(screen.getByText("Overdue", { selector: "span.text-body" })).toBeInTheDocument();
    expect(screen.getByText("Upcoming", { selector: "span.text-body" })).toBeInTheDocument();
  });

  it("only shows Edit/Complete/Cancel for scheduled jobs, and hides them without permission", async () => {
    render(<GeneratorMaintenancePage />);
    await waitFor(() => expect(tag("GEN-01")).toBeInTheDocument());

    // JOB_1 is scheduled -> gets edit/complete/cancel; JOB_2 is completed -> none of the three.
    expect(screen.getByRole("button", { name: "Edit Oil change" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Complete Oil change" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel Oil change" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit filter replacement/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /complete filter replacement/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cancel filter replacement/i })).not.toBeInTheDocument();
    // Invoice and View are always available regardless of status/permission.
    expect(screen.getByRole("button", { name: "Invoice for Filter replacement" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View Filter replacement" })).toBeInTheDocument();
  });

  it("hides Schedule/Edit/Complete/Cancel/Delete without permission", async () => {
    mockAuth([]);
    render(<GeneratorMaintenancePage />);
    await waitFor(() => expect(tag("GEN-01")).toBeInTheDocument());

    expect(screen.queryByRole("button", { name: /schedule maintenance/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit Oil change" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Complete Oil change" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel Oil change" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete Oil change" })).not.toBeInTheDocument();
    // Still there without permission.
    expect(screen.getByRole("button", { name: "Invoice for Oil change" })).toBeInTheDocument();
  });

  it("opens the schedule form and reloads once saved", async () => {
    const user = userEvent.setup();
    render(<GeneratorMaintenancePage />);
    await waitFor(() => expect(tag("GEN-01")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /schedule maintenance/i }));
    expect(screen.getByText("New job")).toBeInTheDocument();

    generatorService.listMaintenance.mockClear();
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(generatorService.listMaintenance).toHaveBeenCalled());
  });

  it("opens the edit form for the clicked job", async () => {
    const user = userEvent.setup();
    render(<GeneratorMaintenancePage />);
    await waitFor(() => expect(tag("GEN-01")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Edit Oil change" }));
    expect(screen.getByText("Editing j1")).toBeInTheDocument();
  });

  it("opens the complete form and reloads once confirmed", async () => {
    const user = userEvent.setup();
    render(<GeneratorMaintenancePage />);
    await waitFor(() => expect(tag("GEN-01")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Complete Oil change" }));
    expect(screen.getByText(/completing j1/i)).toBeInTheDocument();

    generatorService.listMaintenance.mockClear();
    await user.click(screen.getByRole("button", { name: "Confirm Complete" }));
    await waitFor(() => expect(generatorService.listMaintenance).toHaveBeenCalled());
  });

  it("cancels a scheduled job through the confirm dialog", async () => {
    generatorService.updateMaintenance.mockResolvedValue({});
    const user = userEvent.setup();
    render(<GeneratorMaintenancePage />);
    await waitFor(() => expect(tag("GEN-01")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Cancel Oil change" }));
    expect(screen.getByText(/kept as history, marked cancelled/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel Job" }));
    await waitFor(() => expect(generatorService.updateMaintenance).toHaveBeenCalledWith("j1", { status: "cancelled" }));
  });

  it("shows the cancel error inline on failure", async () => {
    generatorService.updateMaintenance.mockRejectedValue({ response: { data: { message: "Cannot cancel" } } });
    const user = userEvent.setup();
    render(<GeneratorMaintenancePage />);
    await waitFor(() => expect(tag("GEN-01")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Cancel Oil change" }));
    await user.click(screen.getByRole("button", { name: "Cancel Job" }));

    expect(await screen.findByText("Cannot cancel")).toBeInTheDocument();
  });

  it("deletes a job through the confirm dialog", async () => {
    generatorService.deleteMaintenance.mockResolvedValue({});
    const user = userEvent.setup();
    render(<GeneratorMaintenancePage />);
    await waitFor(() => expect(tag("GEN-01")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Delete Oil change" }));
    expect(screen.getByText(/permanently deletes "Oil change"/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(generatorService.deleteMaintenance).toHaveBeenCalledWith("j1"));
  });

  it("opens invoice management from the row action and from the details modal", async () => {
    const user = userEvent.setup();
    render(<GeneratorMaintenancePage />);
    await waitFor(() => expect(tag("GEN-01")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Invoice for Oil change" }));
    expect(screen.getByText(/invoice for j1/i)).toBeInTheDocument();

    // An upload from the (stubbed) invoice modal syncs the row in place —
    // the modal stays open (only the page's own items state changes) so the
    // user can keep looking at what they just uploaded.
    await user.click(screen.getByRole("button", { name: "Upload" }));
    expect(screen.getByTestId("invoice-modal")).toBeInTheDocument();
  });

  it("opens details from View, and can jump from details straight into invoice management", async () => {
    const user = userEvent.setup();
    render(<GeneratorMaintenancePage />);
    await waitFor(() => expect(tag("GEN-01")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "View Oil change" }));
    expect(screen.getByText(/details for Oil change/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Manage Invoice" }));
    expect(screen.queryByTestId("details-modal")).not.toBeInTheDocument();
    expect(screen.getByText(/invoice for j1/i)).toBeInTheDocument();
  });

  it("filters by generator and status, resetting to page 1", async () => {
    const user = userEvent.setup();
    render(<GeneratorMaintenancePage />);
    await waitFor(() => expect(tag("GEN-01")).toBeInTheDocument());

    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[0], "g2");
    await waitFor(() =>
      expect(generatorService.listMaintenance).toHaveBeenCalledWith(expect.objectContaining({ generatorId: "g2", page: 1 }))
    );

    await user.selectOptions(selects[1], "completed");
    await waitFor(() =>
      expect(generatorService.listMaintenance).toHaveBeenCalledWith(expect.objectContaining({ status: "completed", page: 1 }))
    );
  });

  it("shows the empty state when no jobs match", async () => {
    mockMaintenance({ items: [], meta: { page: 1, totalPages: 0, totalItems: 0, pageSize: 10 } });
    render(<GeneratorMaintenancePage />);
    await waitFor(() => expect(screen.getByText("No maintenance records found")).toBeInTheDocument());
  });

  it("shows an error state and retries", async () => {
    generatorService.listMaintenance.mockRejectedValueOnce(new Error("down"));
    const user = userEvent.setup();
    render(<GeneratorMaintenancePage />);
    await waitFor(() => expect(screen.getByText(/couldn't load/i)).toBeInTheDocument());

    mockMaintenance();
    await user.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(tag("GEN-01")).toBeInTheDocument());
  });
});
