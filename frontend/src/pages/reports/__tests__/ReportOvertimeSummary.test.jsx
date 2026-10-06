import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import ReportOvertimeSummary from "../ReportOvertimeSummary";
import { reportsService } from "../../../services/reportsService";
import { pickDate } from "../../../test/datePicker";

vi.mock("../../../services/reportsService", () => ({
  reportsService: { getOvertimeSummaryReport: vi.fn(), exportReport: vi.fn() },
}));

vi.mock("../reportHelpers", async () => {
  const actual = await vi.importActual("../reportHelpers");
  return { ...actual, saveBlob: vi.fn() };
});

const EMPLOYEE_OPTIONS = [{ value: "u1", label: "Alice" }];

const REPORT = {
  from: "2026-03-01T00:00:00.000Z",
  to: "2026-03-31T23:59:59.999Z",
  totalApprovedHours: 12,
  totalRequests: 5,
  employees: [
    { employee: { id: "u1", name: "Alice", department: "Ops" }, pending: 1, approved: 3, rejected: 1, totalRequests: 5, approvedHours: 12 },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  reportsService.getOvertimeSummaryReport.mockResolvedValue(REPORT);
});

describe("<ReportOvertimeSummary />", () => {
  it("shows the stat cards and per-employee rows", async () => {
    render(<ReportOvertimeSummary employeeOptions={EMPLOYEE_OPTIONS} />);
    expect(await screen.findByText("12", { selector: "div.text-2xl" })).toBeInTheDocument();
    expect(screen.getByText("5", { selector: "div.text-2xl" })).toBeInTheDocument();
    expect(screen.getByText("Alice", { selector: "span.font-medium" })).toBeInTheDocument();
  });

  it("filters by an explicit from/to date range", async () => {
    const user = userEvent.setup();
    render(<ReportOvertimeSummary employeeOptions={EMPLOYEE_OPTIONS} />);
    await screen.findByText("Alice", { selector: "span.font-medium" });

    await pickDate(user, "From", "2026-01-01");
    await pickDate(user, "To", "2026-01-31");

    await waitFor(() =>
      expect(reportsService.getOvertimeSummaryReport).toHaveBeenLastCalledWith(
        expect.objectContaining({ from: "2026-01-01", to: "2026-01-31" })
      )
    );
  });

  it("shows the empty state when there are no employees", async () => {
    reportsService.getOvertimeSummaryReport.mockResolvedValue({ ...REPORT, employees: [] });
    render(<ReportOvertimeSummary employeeOptions={EMPLOYEE_OPTIONS} />);
    expect(await screen.findByText("No employees to report on")).toBeInTheDocument();
  });

  it("shows an error state and retries", async () => {
    reportsService.getOvertimeSummaryReport.mockRejectedValueOnce(new Error("down"));
    const user = userEvent.setup();
    render(<ReportOvertimeSummary employeeOptions={EMPLOYEE_OPTIONS} />);
    await waitFor(() => expect(screen.getByText(/couldn't load/i)).toBeInTheDocument());

    reportsService.getOvertimeSummaryReport.mockResolvedValue(REPORT);
    await user.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(screen.getByText("Alice", { selector: "span.font-medium" })).toBeInTheDocument());
  });

  it("exports CSV with the current filters", async () => {
    reportsService.exportReport.mockResolvedValue({ blob: new Blob(["x"]), filename: "overtime-summary.csv" });
    const user = userEvent.setup();
    render(<ReportOvertimeSummary employeeOptions={EMPLOYEE_OPTIONS} />);
    await screen.findByText("Alice", { selector: "span.font-medium" });

    await user.click(screen.getByRole("button", { name: /export csv/i }));

    await waitFor(() =>
      expect(reportsService.exportReport).toHaveBeenCalledWith("overtime-summary", expect.objectContaining({ format: "csv" }))
    );
  });

  it("exports PDF with the current filters", async () => {
    reportsService.exportReport.mockResolvedValue({ blob: new Blob(["x"]), filename: "overtime-summary.pdf" });
    const user = userEvent.setup();
    render(<ReportOvertimeSummary employeeOptions={EMPLOYEE_OPTIONS} />);
    await screen.findByText("Alice", { selector: "span.font-medium" });

    await user.click(screen.getByRole("button", { name: /export pdf/i }));

    await waitFor(() =>
      expect(reportsService.exportReport).toHaveBeenCalledWith("overtime-summary", expect.objectContaining({ format: "pdf" }))
    );
  });

  it("shows an error message when export fails", async () => {
    reportsService.exportReport.mockRejectedValue(new Error("export failed"));
    const user = userEvent.setup();
    render(<ReportOvertimeSummary employeeOptions={EMPLOYEE_OPTIONS} />);
    await screen.findByText("Alice", { selector: "span.font-medium" });

    await user.click(screen.getByRole("button", { name: /export csv/i }));

    expect(await screen.findByText("export failed")).toBeInTheDocument();
  });
});
