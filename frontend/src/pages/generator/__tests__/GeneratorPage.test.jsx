import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import GeneratorPage from "../GeneratorPage";
import { generatorService } from "../../../services/generatorService";
import { useAuth } from "../../../context/AuthContext";

vi.mock("../../../services/generatorService", () => ({
  generatorService: {
    listGenerators: vi.fn(),
    deleteGenerator: vi.fn(),
    listLogs: vi.fn(),
    listMaintenance: vi.fn(),
  },
}));

vi.mock("../../../context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

const GEN_1 = {
  _id: "g1",
  tag: "GEN-01",
  name: "Main Hall Generator",
  location: "Roof",
  status: "operational",
  runningHoursTotal: 120.5,
};
const GEN_2 = {
  _id: "g2",
  tag: "GEN-02",
  name: "Backup Generator",
  location: "",
  status: "faulty",
  runningHoursTotal: 40,
};

function mockAuth(permissions = []) {
  useAuth.mockReturnValue({ hasPermission: (p) => permissions.includes(p) });
}

// listGenerators is called once for the main list and three more times (one
// per status) for the stat cards — respond to all four with sane defaults
// unless a test overrides them.
function mockList({ items = [GEN_1, GEN_2], meta = { page: 1, totalPages: 1, totalItems: 2, pageSize: 10 } } = {}) {
  generatorService.listGenerators.mockImplementation((params = {}) => {
    if (params.pageSize === 1) {
      // One of the three stat-card calls.
      const count = params.status === "operational" ? 1 : params.status === "faulty" ? 1 : 0;
      return Promise.resolve({ items: [], meta: { page: 1, totalPages: 1, totalItems: count, pageSize: 1 } });
    }
    return Promise.resolve({ items, meta });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth(["generator.create", "generator.update", "generator.delete"]);
  mockList();
});

describe("GeneratorPage (Registry)", () => {
  it("loads and renders the generator list", async () => {
    render(<GeneratorPage />);
    await waitFor(() => expect(screen.getByText("GEN-01")).toBeInTheDocument());
    expect(screen.getByText("GEN-02")).toBeInTheDocument();
    expect(screen.getByText("Main Hall Generator")).toBeInTheDocument();
    expect(screen.getByText("120h 30m")).toBeInTheDocument();
  });

  it("renders the three status stat cards from separate pageSize:1 requests", async () => {
    render(<GeneratorPage />);
    await waitFor(() => expect(screen.getByText("GEN-01")).toBeInTheDocument());
    await waitFor(() => {
      expect(generatorService.listGenerators).toHaveBeenCalledWith(
        expect.objectContaining({ status: "operational", pageSize: 1 })
      );
      expect(generatorService.listGenerators).toHaveBeenCalledWith(
        expect.objectContaining({ status: "under_maintenance", pageSize: 1 })
      );
      expect(generatorService.listGenerators).toHaveBeenCalledWith(
        expect.objectContaining({ status: "faulty", pageSize: 1 })
      );
    });
  });

  it("shows an em dash location for a generator without one", async () => {
    render(<GeneratorPage />);
    await waitFor(() => expect(screen.getByText("GEN-02")).toBeInTheDocument());
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("searches by typing, resetting to page 1", async () => {
    const user = userEvent.setup();
    render(<GeneratorPage />);
    await waitFor(() => expect(screen.getByText("GEN-01")).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText("Search by tag or name..."), "GEN-01");

    await waitFor(() =>
      expect(generatorService.listGenerators).toHaveBeenCalledWith(
        expect.objectContaining({ search: "GEN-01", page: 1 })
      )
    );
  });

  it("filters by status via the status select", async () => {
    const user = userEvent.setup();
    render(<GeneratorPage />);
    await waitFor(() => expect(screen.getByText("GEN-01")).toBeInTheDocument());

    const statusSelect = screen.getAllByRole("combobox")[0];
    await user.selectOptions(statusSelect, "faulty");

    await waitFor(() =>
      expect(generatorService.listGenerators).toHaveBeenCalledWith(
        expect.objectContaining({ status: "faulty", page: 1 })
      )
    );
  });

  it("shows a Reset button once filtered, which clears the filters", async () => {
    const user = userEvent.setup();
    render(<GeneratorPage />);
    await waitFor(() => expect(screen.getByText("GEN-01")).toBeInTheDocument());

    expect(screen.queryByRole("button", { name: /reset/i })).not.toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Search by tag or name..."), "x");
    const resetButton = await screen.findByRole("button", { name: /reset/i });
    await user.click(resetButton);

    expect(screen.getByPlaceholderText("Search by tag or name...")).toHaveValue("");
  });

  it("shows the empty state when no generators match", async () => {
    mockList({ items: [], meta: { page: 1, totalPages: 0, totalItems: 0, pageSize: 10 } });
    render(<GeneratorPage />);
    await waitFor(() => expect(screen.getByText("No generators found")).toBeInTheDocument());
  });

  it("shows an error state and retries on demand", async () => {
    generatorService.listGenerators.mockImplementation((params = {}) =>
      params.pageSize === 1
        ? Promise.resolve({ items: [], meta: { page: 1, totalPages: 1, totalItems: 0, pageSize: 1 } })
        : Promise.reject(new Error("network down"))
    );
    const user = userEvent.setup();
    render(<GeneratorPage />);
    await waitFor(() => expect(screen.getByText(/couldn't load/i)).toBeInTheDocument());

    mockList();
    await user.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(screen.getByText("GEN-01")).toBeInTheDocument());
  });

  it("hides Add/Edit/Delete controls without the matching permissions", async () => {
    mockAuth([]);
    render(<GeneratorPage />);
    await waitFor(() => expect(screen.getByText("GEN-01")).toBeInTheDocument());

    expect(screen.queryByRole("button", { name: /add generator/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit gen-01/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete gen-01/i })).not.toBeInTheDocument();
    // View is always available, regardless of permission.
    expect(screen.getByRole("button", { name: /view gen-01/i })).toBeInTheDocument();
  });

  it("opens the create form from Add Generator", async () => {
    const user = userEvent.setup();
    render(<GeneratorPage />);
    await waitFor(() => expect(screen.getByText("GEN-01")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /add generator/i }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Add Generator" })).toBeInTheDocument();
  });

  it("opens the edit form pre-filled from the row's Edit button", async () => {
    const user = userEvent.setup();
    render(<GeneratorPage />);
    await waitFor(() => expect(screen.getByText("GEN-01")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /edit gen-01/i }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Edit Generator" })).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Tag", { exact: false })).toHaveValue("GEN-01");
  });

  it("opens the view details modal from the row's View button", async () => {
    generatorService.listLogs.mockResolvedValue({ items: [], meta: {} });
    generatorService.listMaintenance.mockResolvedValue({ items: [], meta: {} });
    const user = userEvent.setup();
    render(<GeneratorPage />);
    await waitFor(() => expect(screen.getByText("GEN-01")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /view gen-01/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Main Hall Generator")).toBeInTheDocument();
  });

  it("deletes a generator through the confirm dialog and reloads the list", async () => {
    generatorService.deleteGenerator.mockResolvedValue({});
    const user = userEvent.setup();
    render(<GeneratorPage />);
    await waitFor(() => expect(screen.getByText("GEN-01")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /delete gen-01/i }));
    expect(screen.getByText(/permanently deletes GEN-01/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(generatorService.deleteGenerator).toHaveBeenCalledWith("g1"));
    // Confirm dialog closes and the list is refetched.
    await waitFor(() => expect(screen.queryByText(/permanently deletes/i)).not.toBeInTheDocument());
  });

  it("shows the delete error inline without closing the dialog on failure", async () => {
    generatorService.deleteGenerator.mockRejectedValue({
      response: { data: { message: "In use", details: undefined } },
    });
    const user = userEvent.setup();
    render(<GeneratorPage />);
    await waitFor(() => expect(screen.getByText("GEN-01")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /delete gen-01/i }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("In use")).toBeInTheDocument();
  });
});
