/**
 * Tests for API client
 * Vitest unit tests for api.ts functions
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import * as api from "@/lib/api";

// Mock fetch globally
global.fetch = vi.fn();

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

describe("API Client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe("fetchBoard", () => {
    it("should fetch board data successfully", async () => {
      const mockBoard: api.Board = {
        id: 1,
        user_id: 1,
        title: "Test Board",
        columns: [
          { id: 1, board_id: 1, title: "To Do", position: 0 },
        ],
        cards: [
          { id: 1, column_id: 1, title: "Task 1", details: "Details", position: 0 },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockBoard,
      });

      const result = await api.fetchBoard();
      expect(result).toEqual(mockBoard);
      expect(global.fetch).toHaveBeenCalledWith("/api/user/board", {
        method: "GET",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      });
    });

    it("should include auth token in request", async () => {
      localStorage.setItem("kanban_auth", JSON.stringify({ token: "test-token" }));

      const mockBoard: api.Board = {
        id: 1,
        user_id: 1,
        title: "Board",
        columns: [],
        cards: [],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockBoard,
      });

      await api.fetchBoard();

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/user/board",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
          }),
        })
      );
    });

    it("should throw APIError on 401", async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({ detail: "Unauthorized" }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({ detail: "Unauthorized" }),
        });

      const firstError = await expect(api.fetchBoard()).rejects.toThrow(api.APIError);
      const secondError = await expect(api.fetchBoard()).rejects.toThrow(api.APIError);
    });

    it("should throw APIError on network error", async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error("Network error"));

      await expect(api.fetchBoard()).rejects.toThrow();
    });
  });

  describe("createCard", () => {
    it("should create a card successfully", async () => {
      const input: api.CardCreate = {
        column_id: 1,
        title: "New Task",
        details: "Do something",
      };

      const mockCard: api.Card = {
        id: 5,
        column_id: 1,
        title: "New Task",
        details: "Do something",
        position: 0,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockCard,
      });

      const result = await api.createCard(input);

      expect(result).toEqual(mockCard);
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/cards",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(input),
        })
      );
    });

    it("should handle missing details", async () => {
      const input: api.CardCreate = {
        column_id: 1,
        title: "Task",
      };

      const mockCard: api.Card = {
        id: 5,
        column_id: 1,
        title: "Task",
        details: "",
        position: 0,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockCard,
      });

      const result = await api.createCard(input);
      expect(result).toEqual(mockCard);
    });
  });

  describe("updateCard", () => {
    it("should update a card successfully", async () => {
      const input: api.CardUpdate = {
        title: "Updated Title",
        details: "Updated details",
      };

      const mockCard: api.Card = {
        id: 5,
        column_id: 1,
        title: "Updated Title",
        details: "Updated details",
        position: 0,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockCard,
      });

      const result = await api.updateCard(5, input);

      expect(result).toEqual(mockCard);
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/cards/5",
        expect.objectContaining({
          method: "PUT",
        })
      );
    });
  });

  describe("deleteCard", () => {
    it("should delete a card successfully", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
      });

      await api.deleteCard(5);

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/cards/5",
        expect.objectContaining({
          method: "DELETE",
        })
      );
    });

    it("should throw on delete failure", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(api.deleteCard(5)).rejects.toThrow(api.APIError);
    });
  });

  describe("updateBoard", () => {
    it("should update board bulk state", async () => {
      const updates: api.BoardUpdate = {
        cards: [
          { id: 1, column_id: 1, position: 0 },
          { id: 2, column_id: 1, position: 1 },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const result = await api.updateBoard(updates);

      expect(result).toEqual({ success: true });
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/board",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify(updates),
        })
      );
    });
  });

  describe("updateColumn", () => {
    it("should update column title", async () => {
      const input: api.ColumnUpdate = { title: "New Title" };

      const mockColumn: api.Column = {
        id: 1,
        board_id: 1,
        title: "New Title",
        position: 0,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockColumn,
      });

      const result = await api.updateColumn(1, input);

      expect(result).toEqual(mockColumn);
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/columns/1",
        expect.objectContaining({
          method: "PUT",
        })
      );
    });
  });

  describe("APIError", () => {
    it("should create APIError with status and message", () => {
      const error = new api.APIError(404, "Not found", { reason: "card" });

      expect(error.status).toBe(404);
      expect(error.message).toBe("Not found");
      expect(error.details).toEqual({ reason: "card" });
      expect(error.name).toBe("APIError");
    });
  });
});
