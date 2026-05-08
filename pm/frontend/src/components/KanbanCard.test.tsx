import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { KanbanCard } from "@/components/KanbanCard";
import type { Card } from "@/lib/kanban";

vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => "" } },
}));

const baseCard: Card = { id: "1", title: "Test card", details: "Some details" };

describe("KanbanCard", () => {
  it("renders card title and details", () => {
    render(<KanbanCard card={baseCard} onDelete={vi.fn()} />);
    expect(screen.getByText("Test card")).toBeInTheDocument();
    expect(screen.getByText("Some details")).toBeInTheDocument();
  });

  it("shows high priority badge", () => {
    const card: Card = { ...baseCard, priority: "high" };
    render(<KanbanCard card={card} onDelete={vi.fn()} />);
    expect(screen.getByText("High")).toBeInTheDocument();
  });

  it("shows medium priority badge", () => {
    const card: Card = { ...baseCard, priority: "medium" };
    render(<KanbanCard card={card} onDelete={vi.fn()} />);
    expect(screen.getByText("Med")).toBeInTheDocument();
  });

  it("shows low priority badge", () => {
    const card: Card = { ...baseCard, priority: "low" };
    render(<KanbanCard card={card} onDelete={vi.fn()} />);
    expect(screen.getByText("Low")).toBeInTheDocument();
  });

  it("shows due date badge when due_date is set", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split("T")[0];
    const card: Card = { ...baseCard, due_date: dateStr };
    render(<KanbanCard card={card} onDelete={vi.fn()} />);
    expect(screen.getByText("Tomorrow")).toBeInTheDocument();
  });

  it("shows Today for current date", () => {
    const today = new Date().toISOString().split("T")[0];
    const card: Card = { ...baseCard, due_date: today };
    render(<KanbanCard card={card} onDelete={vi.fn()} />);
    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it("calls onDelete with card id when delete button clicked", () => {
    const onDelete = vi.fn();
    render(<KanbanCard card={baseCard} onDelete={onDelete} />);
    fireEvent.click(screen.getByLabelText("Delete Test card"));
    expect(onDelete).toHaveBeenCalledWith("1");
  });

  it("does not show edit button when onUpdate is not provided", () => {
    render(<KanbanCard card={baseCard} onDelete={vi.fn()} />);
    expect(screen.queryByLabelText("Edit Test card")).not.toBeInTheDocument();
  });

  it("shows edit button when onUpdate is provided", () => {
    render(<KanbanCard card={baseCard} onDelete={vi.fn()} onUpdate={vi.fn()} />);
    expect(screen.getByLabelText("Edit Test card")).toBeInTheDocument();
  });

  it("enters edit mode when edit button is clicked", () => {
    render(<KanbanCard card={baseCard} onDelete={vi.fn()} onUpdate={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("Edit Test card"));
    expect(screen.getByPlaceholderText("Card title")).toBeInTheDocument();
  });

  it("calls onUpdate with updated values on save", async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(<KanbanCard card={baseCard} onDelete={vi.fn()} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByLabelText("Edit Test card"));

    const titleInput = screen.getByPlaceholderText("Card title");
    fireEvent.change(titleInput, { target: { value: "Updated title" } });
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith("1", expect.objectContaining({ title: "Updated title" }));
    });
  });

  it("exits edit mode on Escape without saving", () => {
    const onUpdate = vi.fn();
    render(<KanbanCard card={baseCard} onDelete={vi.fn()} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByLabelText("Edit Test card"));
    fireEvent.keyDown(screen.getByPlaceholderText("Card title"), { key: "Escape" });
    expect(screen.queryByPlaceholderText("Card title")).not.toBeInTheDocument();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("cancel button exits edit mode without saving", () => {
    const onUpdate = vi.fn();
    render(<KanbanCard card={baseCard} onDelete={vi.fn()} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByLabelText("Edit Test card"));
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByPlaceholderText("Card title")).not.toBeInTheDocument();
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
