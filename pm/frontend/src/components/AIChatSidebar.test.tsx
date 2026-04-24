import { describe, it, expect, vi, beforeEach } from "vitest";
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

  it("renders the chat sidebar when open", () => {
    render(<AIChatSidebar {...defaultProps} />);

    expect(screen.getByText("AI Assistant")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ask me to manage your board...")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(<AIChatSidebar {...defaultProps} isOpen={false} />);

    expect(screen.queryByText("AI Assistant")).not.toBeInTheDocument();
  });
});