import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import ReportsPage from "../ReportsPage";
import { userService } from "../../../services/userService";

vi.mock("../../../services/userService", () => ({
  userService: { options: vi.fn() },
}));

// Every report view has its own dedicated test file; here they're stubbed to
// a label plus the employeeOptions they were handed (and a couple of export
// buttons, like the real views have), so this file can focus purely on
// ReportsPage's own job: tab switching and fetching the shared employee
// options dropdown once for every panel to reuse.
vi.mock("../ReportAttendanceSummary", () => ({
  default: ({ employeeOptions }) => (
    <div>
      Attendance Summary view ({employeeOptions.length} employees)
      <button>Export CSV</button>
      <button>Export PDF</button>
    </div>
  ),
}));
vi.mock("../ReportOvertimeSummary", () => ({
  default: () => (
    <div>
      Overtime Summary view
      <button>Export CSV</button>
      <button>Export PDF</button>
    </div>
  ),
}));
vi.mock("../ReportLeaveUsage", () => ({
  default: () => (
    <div>
      Leave Usage view
      <button>Export CSV</button>
      <button>Export PDF</button>
    </div>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  userService.options.mockResolvedValue([{ _id: "u1", name: "Alice" }, { _id: "u2", name: "Bob" }]);
});

describe("ReportsPage", () => {
  it("shows all three report tabs, Attendance Summary first", () => {
    render(<ReportsPage />);
    const tabs = screen.getAllByRole("tab").map((t) => t.textContent);
    expect(tabs).toEqual(["Attendance Summary", "Overtime Summary", "Leave Usage"]);
  });

  it("renders the Attendance Summary panel by default, with its export buttons", async () => {
    render(<ReportsPage />);
    expect(await screen.findByText(/attendance summary view/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export CSV" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export PDF" })).toBeInTheDocument();
  });

  it("fetches the employee options once and hands them down to the active panel", async () => {
    render(<ReportsPage />);
    expect(await screen.findByText("Attendance Summary view (2 employees)")).toBeInTheDocument();
    expect(userService.options).toHaveBeenCalledTimes(1);
  });

  it("switches panels when a different tab is clicked, without re-fetching employee options", async () => {
    const user = userEvent.setup();
    render(<ReportsPage />);
    await screen.findByText(/attendance summary view/i);

    await user.click(screen.getByRole("tab", { name: "Leave Usage" }));
    expect(screen.getByText(/leave usage view/i)).toBeInTheDocument();
    expect(screen.queryByText(/attendance summary view/i)).not.toBeInTheDocument();
    expect(userService.options).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("tab", { name: "Overtime Summary" }));
    expect(screen.getByText(/overtime summary view/i)).toBeInTheDocument();
  });

  it("leaves the employee options dropdown empty (no crash) if the fetch fails", async () => {
    userService.options.mockRejectedValue(new Error("down"));
    render(<ReportsPage />);
    expect(await screen.findByText("Attendance Summary view (0 employees)")).toBeInTheDocument();
  });
});
