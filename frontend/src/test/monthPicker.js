import { fireEvent, screen } from "@testing-library/react";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Drives the common/MonthPicker component: open it, navigate to the target
// year if it isn't already showing (opens on the current year when blank),
// click the month button, then OK to commit. See src/test/datePicker.js for
// the equivalent day-level helper and why fireEvent is used for navigation.
export async function pickMonth(user, label, monthStr) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await user.click(screen.getByLabelText(new RegExp(`^${escaped}\\*?$`)));

  const [targetYear, targetMonth] = monthStr.split("-").map(Number);
  const now = new Date();
  let delta = targetYear - now.getFullYear();
  const stepLabel = delta < 0 ? "Previous year" : "Next year";
  for (let i = 0; i < Math.abs(delta); i++) {
    fireEvent.click(screen.getByRole("button", { name: stepLabel }));
  }

  await user.click(screen.getByRole("button", { name: MONTHS_SHORT[targetMonth - 1] }));
  await user.click(screen.getByRole("button", { name: "OK" }));
}
