import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Home from "./page";

describe("Kanban board", () => {
  it("renders the initial board and dummy data", async () => {
    render(<Home />);
    expect(screen.getByText("Kanban Atlas")).toBeInTheDocument();
    expect(
      await screen.findByText("Customer research sprint")
    ).toBeInTheDocument();
  });

  it("allows renaming a column", async () => {
    render(<Home />);
    const user = userEvent.setup();
    const input = await screen.findByLabelText("Column name for Backlog");

    await user.clear(input);
    await user.type(input, "Ideas");

    expect(input).toHaveValue("Ideas");
  });

  it("adds and deletes a card", async () => {
    render(<Home />);
    const user = userEvent.setup();
    const backlog = await screen.findByTestId("column-col-backlog");

    await user.type(
      within(backlog).getByLabelText("Add card title for Backlog"),
      "New card"
    );
    await user.type(
      within(backlog).getByLabelText("Add card details for Backlog"),
      "Extra details"
    );
    await user.click(within(backlog).getByRole("button", { name: "Add card" }));

    expect(within(backlog).getByText("New card")).toBeInTheDocument();

    await user.click(within(backlog).getByLabelText("Delete New card"));
    expect(within(backlog).queryByText("New card")).not.toBeInTheDocument();
  });
});
