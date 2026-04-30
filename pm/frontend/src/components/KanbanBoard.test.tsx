import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, beforeEach, describe, it, expect } from "vitest";
import { KanbanBoard } from "@/components/KanbanBoard";
import * as api from "@/lib/api";

vi.mock("@/lib/api");
vi.mock("@/components/AIChatSidebar", () => ({
  AIChatSidebar: () => null,
}));

const mockBoard: api.Board = {
  id: 1,
  user_id: 1,
  title: "Test Board",
  columns: [
    { id: 1, board_id: 1, title: "Backlog", position: 0 },
    { id: 2, board_id: 1, title: "Discovery", position: 1 },
    { id: 3, board_id: 1, title: "In Progress", position: 2 },
    { id: 4, board_id: 1, title: "Review", position: 3 },
    { id: 5, board_id: 1, title: "Done", position: 4 },
  ],
  cards: [
    { id: 1, column_id: 1, title: "Demo Card", details: "Details", position: 0 },
  ],
};

describe("KanbanBoard", () => {
  beforeEach(() => {
    vi.mocked(api.fetchBoard).mockResolvedValue(mockBoard);
    vi.mocked(api.createCard).mockResolvedValue({
      id: 99,
      column_id: 1,
      title: "New card",
      details: "Notes",
      position: 1,
    });
    vi.mocked(api.deleteCard).mockResolvedValue(undefined);
    vi.mocked(api.updateBoard).mockResolvedValue({ success: true });
  });

  it("renders five columns", async () => {
    render(<KanbanBoard />);
    await waitFor(() => {
      expect(screen.getAllByTestId(/^column-/)).toHaveLength(5);
    });
  });

  it("renames a column", async () => {
    render(<KanbanBoard />);
    await waitFor(() => {
      expect(screen.getAllByTestId(/^column-/)).toHaveLength(5);
    });
    const column = screen.getAllByTestId(/^column-/)[0];
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    expect(input).toHaveValue("New Name");
  });

  it("adds and removes a card", async () => {
    render(<KanbanBoard />);
    await waitFor(() => {
      expect(screen.getAllByTestId(/^column-/)).toHaveLength(5);
    });
    const column = screen.getAllByTestId(/^column-/)[0];

    await userEvent.click(within(column).getByRole("button", { name: /add a card/i }));
    await userEvent.type(within(column).getByPlaceholderText(/card title/i), "New card");
    await userEvent.type(within(column).getByPlaceholderText(/details/i), "Notes");
    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    await waitFor(() => {
      expect(within(column).getByText("New card")).toBeInTheDocument();
    });

    await userEvent.click(within(column).getByRole("button", { name: /delete new card/i }));

    await waitFor(() => {
      expect(within(column).queryByText("New card")).not.toBeInTheDocument();
    });
  });
});
