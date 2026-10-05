import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import GeneratorReportServiceHistory from "../GeneratorReportServiceHistory";
import { generatorService } from "../../../services/generatorService";
import { pickDate } from "../../../test/datePicker";

vi.mock("../../../services/generatorService", () => ({
  generatorService: { getServiceHistoryReport: vi.fn() },
}));

const GENERATOR_OPTIONS = [{ value: "g1", label: "GEN-01" }];

const JOB_1 = {
  _id: "j1",
  generator: { tag: "GEN-01" },
  description: "Oil change",
  type: "scheduled",
  scheduledDate: "2026-03-01T00:00:00.000Z",
  completedDate: "2026-03-02T00:00:00.000Z",
  status: "completed",
  vendor: "AutoServ",
  cost: 5000,
};
const JOB_2 = {
  _id: "j2",
  generator: null,
  description: "Filter swap",
  type: "unscheduled",
  scheduledDate: "2026-02-01T00:00:00.000Z",
  completedDate: null,
  status: "cancelled",
  vendor: "",
  cost: 0,
};

function mockHistory({ items = [JOB_1, JOB_2], meta = { page: 1, totalPages: 1, totalItems: 2, pageSize: 10 } } = {}) {
  generatorService.getServiceHistoryReport.mockResolvedValue({ items, meta });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockHistory();
});

describe("<GeneratorReportServiceHistory />", () => {
  it("renders jobs with generator, status badge and vendor", async () => {
    render(<GeneratorReportServiceHistory generatorOptions={GENERATOR_OPTIONS} />);
    await waitFor(() => expect(screen.getByText("GEN-01", { selector: "span.font-medium" })).toBeInTheDocument());
    expect(screen.getByText("Oil change")).toBeInTheDocument();
    expect(screen.getByText("AutoServ")).toBeInTheDocument();
    // A job with no linked generator (e.g. one since deleted) falls back to "—".
    expect(screen.getByText("Filter swap")).toBeInTheDocument();
  });

  it("filters by generator, status and date range, resetting to page 1 each time", async () => {
    const user = userEvent.setup();
    render(<GeneratorReportServiceHistory generatorOptions={GENERATOR_OPTIONS} />);
    await waitFor(() => expect(screen.getByText("Oil change")).toBeInTheDocument());

    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[0], "g1");
    await waitFor(() =>
      expect(generatorService.getServiceHistoryReport).toHaveBeenLastCalledWith(
        expect.objectContaining({ generatorId: "g1", page: 1 })
      )
    );

    await user.selectOptions(selects[1], "completed");
    await waitFor(() =>
      expect(generatorService.getServiceHistoryReport).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "completed", page: 1 })
      )
    );

    await pickDate(user, "From", "2026-01-01");
    await waitFor(() =>
      expect(generatorService.getServiceHistoryReport).toHaveBeenLastCalledWith(
        expect.objectContaining({ from: "2026-01-01", page: 1 })
      )
    );
  });

  it("shows Reset once filtered and clears every filter", async () => {
    const user = userEvent.setup();
    render(<GeneratorReportServiceHistory generatorOptions={GENERATOR_OPTIONS} />);
    await waitFor(() => expect(screen.getByText("Oil change")).toBeInTheDocument());

    await user.selectOptions(screen.getAllByRole("combobox")[0], "g1");
    const resetButton = await screen.findByRole("button", { name: /reset/i });
    await user.click(resetButton);

    expect(screen.getAllByRole("combobox")[0]).toHaveValue("");
  });

  it("shows the empty state when no service history matches", async () => {
    mockHistory({ items: [], meta: { page: 1, totalPages: 0, totalItems: 0, pageSize: 10 } });
    render(<GeneratorReportServiceHistory generatorOptions={GENERATOR_OPTIONS} />);
    expect(await screen.findByText("No service history found")).toBeInTheDocument();
  });

  it("shows an error state and retries", async () => {
    generatorService.getServiceHistoryReport.mockRejectedValueOnce(new Error("down"));
    const user = userEvent.setup();
    render(<GeneratorReportServiceHistory generatorOptions={GENERATOR_OPTIONS} />);
    await waitFor(() => expect(screen.getByText(/couldn't load/i)).toBeInTheDocument());

    mockHistory();
    await user.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(screen.getByText("Oil change")).toBeInTheDocument());
  });
});
