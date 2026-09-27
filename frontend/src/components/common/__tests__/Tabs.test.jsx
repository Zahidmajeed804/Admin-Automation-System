import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import Tabs from "../Tabs";

const TABS = [
  { id: "a", label: "Tab A" },
  { id: "b", label: "Tab B" },
  { id: "c", label: "Tab C" },
];

describe("<Tabs />", () => {
  it("renders a tablist with one tab per entry", () => {
    render(<Tabs tabs={TABS} value="a" onChange={vi.fn()} />);
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.getByRole("tab", { name: "Tab B" })).toBeInTheDocument();
  });

  it("defaults the tablist's accessible label to 'Sections', overridable via `label`", () => {
    const { rerender } = render(<Tabs tabs={TABS} value="a" onChange={vi.fn()} />);
    expect(screen.getByRole("tablist", { name: "Sections" })).toBeInTheDocument();

    rerender(<Tabs tabs={TABS} value="a" onChange={vi.fn()} label="Report type" />);
    expect(screen.getByRole("tablist", { name: "Report type" })).toBeInTheDocument();
  });

  it("marks the active tab selected with a 0 tabIndex, others unselected with -1", () => {
    render(<Tabs tabs={TABS} value="b" onChange={vi.fn()} />);
    const tabA = screen.getByRole("tab", { name: "Tab A" });
    const tabB = screen.getByRole("tab", { name: "Tab B" });
    const tabC = screen.getByRole("tab", { name: "Tab C" });

    expect(tabB).toHaveAttribute("aria-selected", "true");
    expect(tabB).toHaveAttribute("tabindex", "0");
    expect(tabA).toHaveAttribute("aria-selected", "false");
    expect(tabA).toHaveAttribute("tabindex", "-1");
    expect(tabC).toHaveAttribute("aria-selected", "false");
    expect(tabC).toHaveAttribute("tabindex", "-1");
  });

  it("wires aria-controls/id to match the caller's panel-id convention", () => {
    render(<Tabs tabs={TABS} value="a" onChange={vi.fn()} />);
    const tabA = screen.getByRole("tab", { name: "Tab A" });
    expect(tabA).toHaveAttribute("id", "tab-a");
    expect(tabA).toHaveAttribute("aria-controls", "panel-a");
  });

  it("calls onChange with the clicked tab's id", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Tabs tabs={TABS} value="a" onChange={onChange} />);

    await user.click(screen.getByRole("tab", { name: "Tab C" }));
    expect(onChange).toHaveBeenCalledWith("c");
  });

  it("moves to the next/previous tab with ArrowRight/ArrowLeft, wrapping at the ends", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Tabs tabs={TABS} value="a" onChange={onChange} />);

    screen.getByRole("tab", { name: "Tab A" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith("b");

    onChange.mockClear();
    render(<Tabs tabs={TABS} value="a" onChange={onChange} />);
    screen.getAllByRole("tab", { name: "Tab A" })[0].focus();
    await user.keyboard("{ArrowLeft}");
    // Wraps from the first tab back to the last.
    expect(onChange).toHaveBeenLastCalledWith("c");
  });

  it("jumps to the first/last tab with Home/End", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Tabs tabs={TABS} value="b" onChange={onChange} />);

    screen.getByRole("tab", { name: "Tab B" }).focus();
    await user.keyboard("{Home}");
    expect(onChange).toHaveBeenLastCalledWith("a");

    onChange.mockClear();
    render(<Tabs tabs={TABS} value="b" onChange={onChange} />);
    screen.getAllByRole("tab", { name: "Tab B" })[0].focus();
    await user.keyboard("{End}");
    expect(onChange).toHaveBeenLastCalledWith("c");
  });

  it("moves focus to the newly selected tab's button after a keyboard move", async () => {
    const user = userEvent.setup();
    // A controlled re-render is needed for the "next" tab to actually become
    // selected (and thus focusable via a real 0 tabIndex) after the
    // component calls onChange — plain onChange without state update can't
    // exercise document.getElementById(...).focus() meaningfully otherwise,
    // so this wraps Tabs in a tiny controlled harness.
    function Harness() {
      const [value, setValue] = useState("a");
      return <Tabs tabs={TABS} value={value} onChange={setValue} />;
    }
    render(<Harness />);

    screen.getByRole("tab", { name: "Tab A" }).focus();
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("tab", { name: "Tab B" })).toHaveFocus();
  });
});
