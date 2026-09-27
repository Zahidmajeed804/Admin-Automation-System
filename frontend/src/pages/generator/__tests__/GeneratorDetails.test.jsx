import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import GeneratorDetails from "../GeneratorDetails";
import { generatorService } from "../../../services/generatorService";

vi.mock("../../../services/generatorService", () => ({
  generatorService: {
    listLogs: vi.fn(),
    listMaintenance: vi.fn(),
  },
}));

const GENERATOR = {
  _id: "g1",
  tag: "GEN-01",
  name: "Main Hall Generator",
  status: "operational",
  location: "Roof",
  make: "Cummins",
  model: "C150",
  serialNumber: "SN-1",
  capacityKVA: 150,
  fuelType: "diesel",
  fuelTankCapacityLiters: 500,
  runningHoursTotal: 320.4,
  lastServiceDate: "2026-01-10T00:00:00.000Z",
  installationDate: "2023-06-01T00:00:00.000Z",
  notes: "",
};

const LOG = { _id: "l1", hoursRun: 8, reason: "Power outage", date: "2026-02-01T00:00:00.000Z", fuelAddedLiters: 20 };
const NEXT_JOB = { description: "Oil change", scheduledDate: "2026-03-01T00:00:00.000Z", alertStatus: "upcoming" };

describe("<GeneratorDetails />", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders nothing when there is no generator", () => {
    const { container } = render(<GeneratorDetails open onClose={vi.fn()} generator={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the spec fields and a loading state before the fetch resolves", async () => {
    let resolveLogs;
    generatorService.listLogs.mockReturnValue(new Promise((res) => (resolveLogs = res)));
    generatorService.listMaintenance.mockResolvedValue({ items: [] });

    render(<GeneratorDetails open onClose={vi.fn()} generator={GENERATOR} />);

    expect(screen.getByText("Main Hall Generator")).toBeInTheDocument();
    expect(screen.getByText("320.4")).toBeInTheDocument();
    expect(screen.getByText(/loading recent activity/i)).toBeInTheDocument();

    resolveLogs({ items: [] });
    await waitFor(() => expect(screen.queryByText(/loading recent activity/i)).not.toBeInTheDocument());
  });

  it("shows the next scheduled maintenance and recent logs once loaded", async () => {
    generatorService.listLogs.mockResolvedValue({ items: [LOG] });
    generatorService.listMaintenance.mockResolvedValue({ items: [NEXT_JOB] });

    render(<GeneratorDetails open onClose={vi.fn()} generator={GENERATOR} />);

    expect(await screen.findByText("Oil change")).toBeInTheDocument();
    expect(screen.getByText(/8h — Power outage/)).toBeInTheDocument();
    expect(screen.getByText("+20 L")).toBeInTheDocument();
  });

  it("shows placeholder text when there's nothing scheduled and no logs", async () => {
    generatorService.listLogs.mockResolvedValue({ items: [] });
    generatorService.listMaintenance.mockResolvedValue({ items: [] });

    render(<GeneratorDetails open onClose={vi.fn()} generator={GENERATOR} />);

    expect(await screen.findByText("Nothing scheduled.")).toBeInTheDocument();
    expect(screen.getByText("No usage logs recorded yet.")).toBeInTheDocument();
  });

  it("shows an error state and retries on demand", async () => {
    generatorService.listLogs.mockRejectedValueOnce(new Error("boom"));
    generatorService.listMaintenance.mockRejectedValueOnce(new Error("boom"));
    const user = userEvent.setup();

    render(<GeneratorDetails open onClose={vi.fn()} generator={GENERATOR} />);
    expect(await screen.findByText(/couldn't load recent logs/i)).toBeInTheDocument();

    generatorService.listLogs.mockResolvedValue({ items: [] });
    generatorService.listMaintenance.mockResolvedValue({ items: [] });
    await user.click(screen.getByRole("button", { name: /try again/i }));

    await waitFor(() => expect(screen.getByText("Nothing scheduled.")).toBeInTheDocument());
  });

  it("renders the notes section only when notes are present", async () => {
    generatorService.listLogs.mockResolvedValue({ items: [] });
    generatorService.listMaintenance.mockResolvedValue({ items: [] });

    const { rerender } = render(<GeneratorDetails open onClose={vi.fn()} generator={GENERATOR} />);
    await waitFor(() => expect(screen.getByText("Nothing scheduled.")).toBeInTheDocument());
    expect(screen.queryByText("Notes")).not.toBeInTheDocument();

    rerender(<GeneratorDetails open onClose={vi.fn()} generator={{ ...GENERATOR, notes: "Handle with care" }} />);
    expect(await screen.findByText("Handle with care")).toBeInTheDocument();
  });
});
