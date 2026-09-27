import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import GeneratorLayout from "../GeneratorLayout";
import { useAuth } from "../../../context/AuthContext";

vi.mock("../../../context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

function mockAuth(permissions = []) {
  useAuth.mockReturnValue({ hasPermission: (p) => permissions.includes(p) });
}

// A minimal route tree standing in for AppRoutes' real generator subtree,
// just enough for GeneratorLayout's own active-tab/permission logic to be
// exercised through real navigation.
function renderAt(initialPath) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/generator" element={<GeneratorLayout />}>
          <Route index element={<div>Registry panel</div>} />
          <Route path="logs" element={<div>Logs panel</div>} />
          <Route path="maintenance" element={<div>Maintenance panel</div>} />
          <Route path="reports" element={<div>Reports panel</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("GeneratorLayout", () => {
  it("renders the section heading and the outlet's panel", () => {
    mockAuth(["reports.read"]);
    renderAt("/generator");
    expect(screen.getByText("Generator Management")).toBeInTheDocument();
    expect(screen.getByText("Registry panel")).toBeInTheDocument();
  });

  it("shows all four tabs when the user holds reports.read", () => {
    mockAuth(["reports.read"]);
    renderAt("/generator");
    expect(screen.getAllByRole("tab")).toHaveLength(4);
    expect(screen.getByRole("tab", { name: "Reports" })).toBeInTheDocument();
  });

  it("hides the Reports tab without reports.read", () => {
    mockAuth([]);
    renderAt("/generator");
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.queryByRole("tab", { name: "Reports" })).not.toBeInTheDocument();
  });

  it("marks Registry active on the index route", () => {
    mockAuth(["reports.read"]);
    renderAt("/generator");
    expect(screen.getByRole("tab", { name: "Registry" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Fuel & Usage Logs" })).toHaveAttribute("aria-selected", "false");
  });

  it("marks Logs active on /generator/logs, not Registry (longest-match, not prefix)", () => {
    mockAuth(["reports.read"]);
    renderAt("/generator/logs");
    expect(screen.getByText("Logs panel")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Fuel & Usage Logs" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Registry" })).toHaveAttribute("aria-selected", "false");
  });

  it("marks Maintenance active on /generator/maintenance", () => {
    mockAuth(["reports.read"]);
    renderAt("/generator/maintenance");
    expect(screen.getByText("Maintenance panel")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Maintenance" })).toHaveAttribute("aria-selected", "true");
  });

  it("navigates to the clicked tab's route", async () => {
    mockAuth(["reports.read"]);
    const user = userEvent.setup();
    renderAt("/generator");

    await user.click(screen.getByRole("tab", { name: "Maintenance" }));
    expect(await screen.findByText("Maintenance panel")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Maintenance" })).toHaveAttribute("aria-selected", "true");
  });
});
