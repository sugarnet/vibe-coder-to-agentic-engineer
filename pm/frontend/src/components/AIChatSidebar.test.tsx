import { describe, it, expect, vi, beforeEach } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AIChatSidebar } from "./AIChatSidebar";
import * as api from "@/lib/api";
import type { BoardData } from "@/lib/kanban";

// Mock scrollIntoView
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  writable: true,
  value: vi.fn(),
});

// Mock the API
vi.mock("@/lib/api", () => ({
  sendChatMessage: vi.fn(),
  fetchChatHistory: vi.fn(),
}));

const mockBoardData: BoardData = {
  columns: [
    { id: "col-1", title: "Backlog", cardIds: ["card-1"] },
    { id: "col-2", title: "In Progress", cardIds: [] },
  ],
  cards: {
    "card-1": { id: "card-1", title: "Test Card", details: "Test details" },
  },
};

describe("AIChatSidebar", () => {
  const defaultProps = {
    boardData: mockBoardData,
    onBoardUpdate: vi.fn(),
    isOpen: true,
    onToggle: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the chat sidebar when open", async () => {
    vi.mocked(api.fetchChatHistory).mockResolvedValueOnce([]);

    render(<AIChatSidebar {...defaultProps} />);

    await waitFor(() => {
      expect(api.fetchChatHistory).toHaveBeenCalled();
    });

    expect(screen.getByText("AI Assistant")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ask me to manage your board...")).toBeInTheDocument();
  });

  it("loads previous chat history on mount", async () => {
    vi.mocked(api.fetchChatHistory).mockResolvedValueOnce([
      { id: 1, role: "assistant", content: "Welcome back!", created_at: "2026-04-25T10:00:00.000Z" },
      { id: 2, role: "user", content: "Hello again", created_at: "2026-04-25T10:00:01.000Z" },
    ]);

    render(<AIChatSidebar {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Welcome back!")).toBeInTheDocument();
      expect(screen.getByText("Hello again")).toBeInTheDocument();
    });
  });

  it("does not render when closed", async () => {
    vi.mocked(api.fetchChatHistory).mockResolvedValueOnce([]);
    render(<AIChatSidebar {...defaultProps} isOpen={false} />);

    await waitFor(() => {
      expect(api.fetchChatHistory).toHaveBeenCalled();
    });

    expect(screen.queryByText("AI Assistant")).not.toBeInTheDocument();
  });

  it("retains previous chat bubbles after closing and reopening", async () => {
    vi.mocked(api.fetchChatHistory).mockResolvedValueOnce([
      { id: 1, role: "assistant", content: "Previous answer", created_at: "2026-04-25T10:00:00.000Z" },
    ]);

    const { rerender } = render(<AIChatSidebar {...defaultProps} isOpen={false} />);

    rerender(<AIChatSidebar {...defaultProps} isOpen={true} />);

    await waitFor(() => {
      expect(api.fetchChatHistory).toHaveBeenCalled();
      expect(screen.getByText("Previous answer")).toBeInTheDocument();
    });

    rerender(<AIChatSidebar {...defaultProps} isOpen={false} />);
    rerender(<AIChatSidebar {...defaultProps} isOpen={true} />);

    expect(screen.getByText("Previous answer")).toBeInTheDocument();
  });

  it("calls onBoardUpdate when the AI response includes board updates", async () => {
    vi.mocked(api.sendChatMessage).mockResolvedValueOnce({
      response: "Card created successfully.",
      board_updates: [
        {
          action: "create_card",
          title: "New AI Card",
          details: "Created by AI",
          column_id: "col-1",
        },
      ],
    });

    render(<AIChatSidebar {...defaultProps} />);

    fireEvent.change(screen.getByPlaceholderText("Ask me to manage your board..."), {
      target: { value: "Create a new AI task" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => {
      expect(screen.getByText("Card created successfully.")).toBeInTheDocument();
    });

    expect(defaultProps.onBoardUpdate).toHaveBeenCalledTimes(1);
  });

  it("does not call onBoardUpdate when the AI response has no board updates", async () => {
    vi.mocked(api.sendChatMessage).mockResolvedValueOnce({
      response: "I can help with your board.",
      board_updates: undefined,
    });

    render(<AIChatSidebar {...defaultProps} />);

    fireEvent.change(screen.getByPlaceholderText("Ask me to manage your board..."), {
      target: { value: "Just say hello" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => {
      expect(screen.getByText("I can help with your board.")).toBeInTheDocument();
    });

    expect(defaultProps.onBoardUpdate).not.toHaveBeenCalled();
  });
});