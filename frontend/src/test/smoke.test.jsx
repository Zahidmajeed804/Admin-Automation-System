import { render, screen } from "@testing-library/react";
import Badge from "../components/common/Badge";

describe("smoke: frontend test pipeline", () => {
  it("renders a Badge with its label", () => {
    render(
      <Badge color="#000" bg="#fff">
        Test Badge
      </Badge>
    );
    expect(screen.getByText("Test Badge")).toBeInTheDocument();
  });
});
