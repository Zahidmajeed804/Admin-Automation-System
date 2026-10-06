import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HoursMinutesInput from "../HoursMinutesInput";

function Harness({ initial = "" }) {
  const [value, setValue] = useState(initial);
  return <HoursMinutesInput id="test-hm" label="Hours Run" value={value} onChange={setValue} />;
}

describe("<HoursMinutesInput />", () => {
  it("displays the hours and minutes split from a decimal-hours value", () => {
    render(<HoursMinutesInput id="hm" label="Hours Run" value="12.5" onChange={vi.fn()} />);
    expect(screen.getByLabelText("Hours Run — hours")).toHaveValue(12);
    expect(screen.getByLabelText("Hours Run — minutes")).toHaveValue(30);
  });

  it("shows 20 minutes exactly for 1/3 hour, not 19 or 21", () => {
    render(<HoursMinutesInput id="hm" label="Hours Run" value={String(20 / 60)} onChange={vi.fn()} />);
    expect(screen.getByLabelText("Hours Run — minutes")).toHaveValue(20);
  });

  it("emits the combined decimal-hours string when either box changes", async () => {
    const user = userEvent.setup();
    render(<Harness initial="" />);

    await user.type(screen.getByLabelText("Hours Run — hours"), "4");
    await user.type(screen.getByLabelText("Hours Run — minutes"), "30");

    expect(screen.getByLabelText("Hours Run — hours")).toHaveValue(4);
    expect(screen.getByLabelText("Hours Run — minutes")).toHaveValue(30);
  });

  it("carries minutes over 59 into hours, like a clock (75m -> 1h 15m)", async () => {
    const user = userEvent.setup();
    render(<Harness initial="" />);
    await user.type(screen.getByLabelText("Hours Run — minutes"), "75");
    expect(screen.getByLabelText("Hours Run — hours")).toHaveValue(1);
    expect(screen.getByLabelText("Hours Run — minutes")).toHaveValue(15);
  });

  it("shows the parent error message over the local minutes warning", () => {
    render(<HoursMinutesInput id="hm" label="Hours Run" value="4" onChange={vi.fn()} error="Hours run is required" />);
    expect(screen.getByText("Hours run is required")).toBeInTheDocument();
  });

  it("shows helper text when there is no error", () => {
    render(<HoursMinutesInput id="hm" label="Hours Run" value="" onChange={vi.fn()} helperText="Enter the time run" />);
    expect(screen.getByText("Enter the time run")).toBeInTheDocument();
  });
});
