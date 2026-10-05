import { render, screen } from "@testing-library/react";
import { dueInLine, DueInfo } from "../DueInfo";
import { formatHoursMinutes } from "../../../utils/hoursMinutes";

describe("dueInLine", () => {
  it("formats an upcoming value as 'Due in ...'", () => {
    expect(dueInLine(2.5, formatHoursMinutes)).toBe("Due in 2h 30m");
  });

  it("formats an overdue (negative) value as 'Overdue by ...', using the magnitude", () => {
    expect(dueInLine(-2.5, formatHoursMinutes)).toBe("Overdue by 2h 30m");
  });

  it("returns null for undefined/null", () => {
    expect(dueInLine(undefined, formatHoursMinutes)).toBeNull();
    expect(dueInLine(null, formatHoursMinutes)).toBeNull();
  });
});

describe("<DueInfo />", () => {
  it("shows hours as 'Xh Ym', not a raw decimal", () => {
    render(<DueInfo row={{ status: "scheduled", alertStatus: "upcoming", hoursUntilDue: 2 + 20 / 60 }} />);
    expect(screen.getByText("Due in 2h 20m")).toBeInTheDocument();
  });

  it("joins days and hours when a job tracks both", () => {
    render(<DueInfo row={{ status: "scheduled", alertStatus: "upcoming", daysUntilDue: 3, hoursUntilDue: 1.5 }} />);
    expect(screen.getByText("Due in 3d · Due in 1h 30m")).toBeInTheDocument();
  });

  it("renders nothing for a job that isn't scheduled", () => {
    const { container } = render(<DueInfo row={{ status: "completed" }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
