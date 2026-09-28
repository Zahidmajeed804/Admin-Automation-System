import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import GeneratorLogsPage from "../GeneratorLogsPage";
import { generatorService } from "../../../services/generatorService";
import { useAuth } from "../../../context/AuthContext";

vi.mock("../../../services/generatorService", () => ({
  generatorService: {
    listGenerators: vi.fn(),
    listLogs: vi.fn(),
    deleteLog: vi.fn(),
  },
}));

vi.mock("../../../context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

// The form itself is covered in its own dedicated test file (AAS-375); here
// it's stubbed down to just its open/log/onSaved contract so the page's own
// orchestration (filters, table, delete flow) can be tested in isolation.
vi.mock("../GeneratorLogForm", () => ({
  default: ({ open, log, onSaved }) =>
    open ? (
      <div data-testid="log-form">
        {log ? `Editing ${log._id}` : "New log"}
        <button onClick={() => onSaved()}>Save</button>
      </div>
    ) : null,
}));

const LOG_1 = {
  _id: "l1",
  generator: { tag: "GEN-01" },
  date: "2026-02-01T00:00:00.000Z",
  hoursRun: 8,
  fuelAddedLiters: 20,
  fuelConsumedLiters: 5,
  openingFuelLiters: 100,
  closingFuelLiters: 115,
  fuelCostTotal: 3000,
  fuelVendor: "Shell",
  reason: "Power outage",
  recordedBy: { name: "Ali" },
};
const LOG_2 = {
  _id: "l2",
  generator: { tag: "GEN-02" },
  date: "2026-02-02T00:00:00.000Z",
  hoursRun: 4,
  fuelAddedLiters: 0,
  fuelConsumedLiters: 0,
  openingFuelLiters: null,
  closingFuelLiters: null,
  fuelCostTotal: 0,
  fuelVendor: "",
  reason: "",
  recordedBy: null,
};

function mockAuth(permissions = []) {
  useAuth.mockReturnValue({ hasPermission: (p) => permissions.includes(p) });
}

function mockLogs({ items = [LOG_1, LOG_2], meta = { page: 1, totalPages: 1, totalItems: 2, pageSize: 10 } } = {}) {
  generatorService.listLogs.mockResolvedValue({ items, meta });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth(["generator_log.create", "generator_log.update", "generator_log.delete"]);
  generatorService.listGenerators.mockResolvedValue({
    items: [{ _id: "g1", tag: "GEN-01" }, { _id: "g2", tag: "GEN-02" }],
    meta: {},
  });
  mockLogs();
});

describe("GeneratorLogsPage", () => {
  it("renders logs with generator tag, fuel movement and tank levels", async () => {
    render(<GeneratorLogsPage />);
    await waitFor(() => expect(screen.getByText("GEN-01", { selector: "span.font-medium" })).toBeInTheDocument());
    expect(screen.getByText("+20 L")).toBeInTheDocument();
    expect(screen.getByText("5 L")).toBeInTheDocument();
    expect(screen.getByText("100 L")).toBeInTheDocument();
    expect(screen.getByText("115 L")).toBeInTheDocument();
    expect(screen.getByText("Shell")).toBeInTheDocument();
    expect(screen.getByText("Ali")).toBeInTheDocument();
  });

  it("shows an em dash for a row with no fuel movement, vendor or recordedBy", async () => {
    render(<GeneratorLogsPage />);
    await waitFor(() => expect(screen.getByText("GEN-02", { selector: "span.font-medium" })).toBeInTheDocument());
    // Fuel Movement cell has neither Added nor Used lines -> "—".
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThan(0);
  });

  it("hides Add/Edit/Delete without the matching generator_log permissions", async () => {
    mockAuth([]);
    render(<GeneratorLogsPage />);
    await waitFor(() => expect(screen.getByText("GEN-01", { selector: "span.font-medium" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /add log/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit gen-01/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete gen-01/i })).not.toBeInTheDocument();
  });

  it("opens the add-log form and reloads the list once saved", async () => {
    const user = userEvent.setup();
    render(<GeneratorLogsPage />);
    await waitFor(() => expect(screen.getByText("GEN-01", { selector: "span.font-medium" })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /add log/i }));
    expect(screen.getByText("New log")).toBeInTheDocument();

    generatorService.listLogs.mockClear();
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(generatorService.listLogs).toHaveBeenCalled());
    expect(screen.queryByTestId("log-form")).not.toBeInTheDocument();
  });

  it("opens the edit form for the clicked row's log", async () => {
    const user = userEvent.setup();
    render(<GeneratorLogsPage />);
    await waitFor(() => expect(screen.getByText("GEN-01", { selector: "span.font-medium" })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /edit gen-01 log/i }));
    expect(screen.getByText("Editing l1")).toBeInTheDocument();
  });

  it("filters by generator and by date range, resetting to page 1 each time", async () => {
    const user = userEvent.setup();
    render(<GeneratorLogsPage />);
    await waitFor(() => expect(screen.getByText("GEN-01", { selector: "span.font-medium" })).toBeInTheDocument());

    await user.selectOptions(screen.getByRole("combobox"), "g2");
    await waitFor(() =>
      expect(generatorService.listLogs).toHaveBeenCalledWith(expect.objectContaining({ generatorId: "g2", page: 1 }))
    );

    await user.type(screen.getByLabelText("From date"), "2026-01-01");
    await waitFor(() =>
      expect(generatorService.listLogs).toHaveBeenCalledWith(expect.objectContaining({ from: "2026-01-01", page: 1 }))
    );
  });

  it("shows Reset once filtered and clears every filter", async () => {
    const user = userEvent.setup();
    render(<GeneratorLogsPage />);
    await waitFor(() => expect(screen.getByText("GEN-01", { selector: "span.font-medium" })).toBeInTheDocument());

    await user.selectOptions(screen.getByRole("combobox"), "g2");
    const resetButton = await screen.findByRole("button", { name: /reset/i });
    await user.click(resetButton);

    expect(screen.getByRole("combobox")).toHaveValue("");
  });

  it("deletes a log through the confirm dialog, mentioning the hours it removes", async () => {
    generatorService.deleteLog.mockResolvedValue({});
    const user = userEvent.setup();
    render(<GeneratorLogsPage />);
    await waitFor(() => expect(screen.getByText("GEN-01", { selector: "span.font-medium" })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /delete gen-01 log/i }));
    expect(screen.getByText(/takes its 8 h off the generator's running hours/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(generatorService.deleteLog).toHaveBeenCalledWith("l1"));
  });

  it("shows the delete error inline without closing the dialog on failure", async () => {
    generatorService.deleteLog.mockRejectedValue({ response: { data: { message: "Cannot delete" } } });
    const user = userEvent.setup();
    render(<GeneratorLogsPage />);
    await waitFor(() => expect(screen.getByText("GEN-01", { selector: "span.font-medium" })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /delete gen-01 log/i }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("Cannot delete")).toBeInTheDocument();
  });

  it("shows the empty state when there are no logs", async () => {
    mockLogs({ items: [], meta: { page: 1, totalPages: 0, totalItems: 0, pageSize: 10 } });
    render(<GeneratorLogsPage />);
    await waitFor(() => expect(screen.getByText("No logs found")).toBeInTheDocument());
  });

  it("shows an error state and retries", async () => {
    generatorService.listLogs.mockRejectedValueOnce(new Error("down"));
    const user = userEvent.setup();
    render(<GeneratorLogsPage />);
    await waitFor(() => expect(screen.getByText(/couldn't load/i)).toBeInTheDocument());

    mockLogs();
    await user.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(screen.getByText("GEN-01", { selector: "span.font-medium" })).toBeInTheDocument());
  });
});
