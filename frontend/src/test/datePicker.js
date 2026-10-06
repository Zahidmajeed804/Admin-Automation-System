import { fireEvent, screen } from "@testing-library/react";

// Drives the common/DatePicker component the same way a person would: open
// it (its trigger is labelled the same way a plain Input's would be),
// navigate to the target month if it isn't already showing (the picker
// opens on today's month when the field is blank), click the day cell, then
// OK to commit. `label` matches the picker's own `label` prop via its
// <label htmlFor>, same as screen.getByLabelText would find a native input.
export async function pickDate(user, label, dateStr) {
  // Anchored, not a bare substring match: a required field's label gets a
  // trailing "*", and a loose match could otherwise hit an unrelated
  // aria-label elsewhere on the page that happens to start the same way.
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await user.click(screen.getByLabelText(new RegExp(`^${escaped}\\*?$`)));

  const [targetYear, targetMonth] = dateStr.split("-").map(Number);
  const now = new Date();
  let delta = (targetYear - now.getFullYear()) * 12 + (targetMonth - 1 - now.getMonth());
  const stepLabel = delta < 0 ? "Previous month" : "Next month";
  // fireEvent (not userEvent) for pure month-navigation clicks: they aren't
  // what the test is exercising, and userEvent's realistic per-click delay
  // across many months was timing out under full-suite CPU contention.
  for (let i = 0; i < Math.abs(delta); i++) {
    fireEvent.click(screen.getByRole("button", { name: stepLabel }));
  }

  await user.click(document.querySelector(`[data-date="${dateStr}"]`));
  await user.click(screen.getByRole("button", { name: "OK" }));
}
