import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import ReportLeaveUsage from "../ReportLeaveUsage";
import { reportsService } from "../../../services/reportsService";

vi.mock("../../../services/reportsService", () => ({
  reportsService: { getLeaveUsageReport: vi.fn(), exportReport: vi.fn() },
}));

vi.mock("../reportHelpers", async () => {
  const actual = await vi.importActual("../reportHelpers");
  return { ...actual, saveBlob: vi.fn() };
});

const EMPLOYEE_OPTIONS = [{ value: "u1", label: "Alice" }, { value: "u2", label: "Bob" }];

function leaveTypes(overrides = {}) {
  return {
    casual: { requestCount: 0, approvedDays: 0, pendingDays: 0, rejectedDays: 0, allocated: 10, used: 0, pending: 0, remaining: 10 },
    sick: { requestCount: 0, approvedDays: 0, pendingDays: 0, rejectedDays: 0, allocated: 5, used: 0, pending: 0, remaining: 5 },
    annual: { requestCount: 0, approvedDays: 0, pendingDays: 0, rejectedDays: 0, allocated: 15, used: 0, pending: 0, remaining: 15 },
    unpaid: { requestCount: 0, approvedDays: 0, pendingDays: 0, rejectedDays: 0 },
    ...overrides,
  };
}

const REPORT = {
  from: "2026-01-01T00:00:00.000Z",
  to: "2027-01-01T00:00:00.000Z",
  year: 2026,
  totalApprovedDays: 3,
  employees: [
    {
      employee: { id: "u1", name: "Alice", department: "Ops" },
      leaveTypes: leaveTypes({ casual: { requestCount: 2, approvedDays: 3, pendingDays: 0, rejectedDays: 0, allocated: 10, used: 3, pending: 0, remaining: 7 } }),
      totalApprovedDays: 3,
    },
    {
      employee: { id: "u2", name: "Bob", department: "Sales" },
      leaveTypes: leaveTypes({ sick: { requestCount: 1, approvedDays: 0, pendingDays: 2, rejectedDays: 0, allocated: 5, used: 0, pending: 2, remaining: 5 } }),
      totalApprovedDays: 0,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  reportsService.getLeaveUsageReport.mockResolvedValue(REPORT);
});

describe("<ReportLeaveUsage />", () => {
  it("shows the total approved days stat card and per-employee rows", async () => {
    render(<ReportLeaveUsage employeeOptions={EMPLOYEE_OPTIONS} />);
    expect(await screen.findByText("3", { selector: "div.text-2xl" })).toBeInTheDocument();
    expect(screen.getByText("Alice", { selector: "span.font-medium" })).toBeInTheDocument();
    expect(screen.getByText("Bob", { selector: "span.font-medium" })).toBeInTheDocument();
  });

  it("filters by year", async () => {
    const user = userEvent.setup();
    render(<ReportLeaveUsage employeeOptions={EMPLOYEE_OPTIONS} />);
    await screen.findByText("Alice", { selector: "span.font-medium" });

    await user.selectOptions(screen.getByDisplayValue(/current/i), "2025");

    await waitFor(() => expect(reportsService.getLeaveUsageReport).toHaveBeenLastCalledWith(expect.objectContaining({ year: "2025" })));
  });

  it("status filter narrows rows client-side to employees with activity in that status", async () => {
    const user = userEvent.setup();
    render(<ReportLeaveUsage employeeOptions={EMPLOYEE_OPTIONS} />);
    await screen.findByText("Alice", { selector: "span.font-medium" });
    expect(screen.getByText("Bob", { selector: "span.font-medium" })).toBeInTheDocument();

    await user.selectOptions(screen.getByDisplayValue(/all statuses/i), "approved");

    expect(screen.getByText("Alice", { selector: "span.font-medium" })).toBeInTheDocument();
    expect(screen.queryByText("Bob", { selector: "span.font-medium" })).not.toBeInTheDocument();
    // Status filter never re-fetches — it only reshapes what's already loaded.
    expect(reportsService.getLeaveUsageReport).toHaveBeenCalledTimes(1);
  });

  it("shows the empty state when there are no employees", async () => {
    reportsService.getLeaveUsageReport.mockResolvedValue({ ...REPORT, employees: [] });
    render(<ReportLeaveUsage employeeOptions={EMPLOYEE_OPTIONS} />);
    expect(await screen.findByText("No employees to report on")).toBeInTheDocument();
  });

  it("shows an error state and retries", async () => {
    reportsService.getLeaveUsageReport.mockRejectedValueOnce(new Error("down"));
    const user = userEvent.setup();
    render(<ReportLeaveUsage employeeOptions={EMPLOYEE_OPTIONS} />);
    await waitFor(() => expect(screen.getByText(/couldn't load/i)).toBeInTheDocument());

    reportsService.getLeaveUsageReport.mockResolvedValue(REPORT);
    await user.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(screen.getByText("Alice", { selector: "span.font-medium" })).toBeInTheDocument());
  });

  it("exports CSV with the current filters", async () => {
    reportsService.exportReport.mockResolvedValue({ blob: new Blob(["x"]), filename: "leave-usage-2026.csv" });
    const user = userEvent.setup();
    render(<ReportLeaveUsage employeeOptions={EMPLOYEE_OPTIONS} />);
    await screen.findByText("Alice", { selector: "span.font-medium" });

    await user.click(screen.getByRole("button", { name: /export csv/i }));

    await waitFor(() =>
      expect(reportsService.exportReport).toHaveBeenCalledWith("leave-usage", expect.objectContaining({ format: "csv" }))
    );
  });

  it("exports PDF with the current filters", async () => {
    reportsService.exportReport.mockResolvedValue({ blob: new Blob(["x"]), filename: "leave-usage-2026.pdf" });
    const user = userEvent.setup();
    render(<ReportLeaveUsage employeeOptions={EMPLOYEE_OPTIONS} />);
    await screen.findByText("Alice", { selector: "span.font-medium" });

    await user.click(screen.getByRole("button", { name: /export pdf/i }));

    await waitFor(() =>
      expect(reportsService.exportReport).toHaveBeenCalledWith("leave-usage", expect.objectContaining({ format: "pdf" }))
    );
  });

  it("shows an error message when export fails", async () => {
    reportsService.exportReport.mockRejectedValue(new Error("export failed"));
    const user = userEvent.setup();
    render(<ReportLeaveUsage employeeOptions={EMPLOYEE_OPTIONS} />);
    await screen.findByText("Alice", { selector: "span.font-medium" });

    await user.click(screen.getByRole("button", { name: /export csv/i }));

    expect(await screen.findByText("export failed")).toBeInTheDocument();
  });
});
