import { render, screen } from "@testing-library/react";
import GeneratorMaintenanceDetails from "../GeneratorMaintenanceDetails";

const JOB = {
  _id: "j1",
  description: "Oil change",
  generator: { tag: "GEN-01" },
  status: "scheduled",
  alertStatus: "upcoming",
  type: "scheduled",
  scheduledDate: "2026-03-01T00:00:00.000Z",
  intervalHours: 2.5,
  hoursAtService: 100.5,
  cost: 5000,
};

describe("<GeneratorMaintenanceDetails />", () => {
  it("shows the recurrence interval and hours-at-service as 'Xh Ym', not a raw decimal", () => {
    render(<GeneratorMaintenanceDetails open job={JOB} onClose={vi.fn()} onManageInvoice={vi.fn()} />);
    expect(screen.getByText("every 2h 30m of running")).toBeInTheDocument();
    expect(screen.getByText("100h 30m")).toBeInTheDocument();
  });

  it("shows an em dash when the job hasn't been serviced yet", () => {
    render(<GeneratorMaintenanceDetails open job={{ ...JOB, hoursAtService: null }} onClose={vi.fn()} onManageInvoice={vi.fn()} />);
    const label = screen.getByText("Generator's Hours at Service");
    expect(label.nextElementSibling).toHaveTextContent("—");
  });
});
