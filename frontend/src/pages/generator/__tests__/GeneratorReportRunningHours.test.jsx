import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import GeneratorReportRunningHours from "../GeneratorReportRunningHours";
import { generatorService } from "../../../services/generatorService";

vi.mock("../../../services/generatorService", () => ({
  generatorService: { getRunningHoursReport: vi.fn() },
}));

const GENERATOR_OPTIONS = [{ value: "g1", label: "GEN-01" }];

const REPORT = {
  month: 3,
  year: 2026,
  totalHoursRun: 128.5,
  generators: [
    { generator: { id: "g1", tag: "GEN-01" }, hoursRun: 128.5, logCount: 4 },
    { generator: { id: "g2", tag: "GEN-02" }, hoursRun: 0, logCount: 0 },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  generatorService.getRunningHoursReport.mockResolvedValue(REPORT);
});

describe("<GeneratorReportRunningHours />", () => {
  it("shows the total-hours stat card and per-generator rows, including a zero-activity row", async () => {
    render(<GeneratorReportRunningHours generatorOptions={GENERATOR_OPTIONS} />);
    expect(await screen.findByText("128h 30m", { selector: "div.text-2xl" })).toBeInTheDocument();
    expect(screen.getByText("March 2026", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("GEN-02", { selector: "span.font-medium" })).toBeInTheDocument();
    expect(screen.getByText("0h 0m")).toBeInTheDocument();
  });

  it("re-fetches with the generator and month filters, resetting via Reset", async () => {
    const user = userEvent.setup();
    render(<GeneratorReportRunningHours generatorOptions={GENERATOR_OPTIONS} />);
    await screen.findByText("GEN-01", { selector: "span.font-medium" });

    await user.selectOptions(screen.getByRole("combobox"), "g1");
    await waitFor(() =>
      expect(generatorService.getRunningHoursReport).toHaveBeenLastCalledWith(expect.objectContaining({ generatorId: "g1" }))
    );

    const resetButton = await screen.findByRole("button", { name: /reset/i });
    await user.click(resetButton);
    expect(screen.getByRole("combobox")).toHaveValue("");
  });

  it("shows the empty state when there are no generators", async () => {
    generatorService.getRunningHoursReport.mockResolvedValue({ ...REPORT, generators: [] });
    render(<GeneratorReportRunningHours generatorOptions={GENERATOR_OPTIONS} />);
    expect(await screen.findByText("No generators to report on")).toBeInTheDocument();
  });

  it("shows an error state and retries", async () => {
    generatorService.getRunningHoursReport.mockRejectedValueOnce(new Error("down"));
    const user = userEvent.setup();
    render(<GeneratorReportRunningHours generatorOptions={GENERATOR_OPTIONS} />);
    await waitFor(() => expect(screen.getByText(/couldn't load/i)).toBeInTheDocument());

    generatorService.getRunningHoursReport.mockResolvedValue(REPORT);
    await user.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(screen.getByText("GEN-01", { selector: "span.font-medium" })).toBeInTheDocument());
  });
});
