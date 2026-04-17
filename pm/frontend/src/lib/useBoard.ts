/**
 * useBoard hook - manages board state with backend API
 * Handles fetching, creating, updating, and deleting cards
 */

import { useCallback, useEffect, useState } from "react";
import * as api from "@/lib/api";
import { type BoardData, type Column as LocalColumn, type Card as LocalCard } from "@/lib/kanban";

export type UseBoard = {
  board: BoardData | null;
  isLoading: boolean;
  error: string | null;
  addCard: (columnId: string, title: string, details: string) => Promise<void>;
  updateCard: (cardId: string, title: string, details: string) => Promise<void>;
  deleteCard: (cardId: string) => Promise<void>;
  renameColumn: (columnId: string, title: string) => Promise<void>;
  moveCard: (cardId: string, fromColumnId: string, toColumnId: string) => Promise<void>;
  retry: () => Promise<void>;
};

/**
 * Convert API Board to local BoardData format
 */
function convertApiToLocal(apiBoardData: api.Board): BoardData {
  // Build columns in the order returned by API
  const columns: LocalColumn[] = apiBoardData.columns.map((col) => ({
    id: col.id.toString(),
    title: col.title,
    cardIds: apiBoardData.cards
      .filter((card) => card.column_id === col.id)
      .sort((a, b) => a.position - b.position)
      .map((card) => card.id.toString()),
  }));

  // Build cards map
  const cards: Record<string, LocalCard> = {};
  apiBoardData.cards.forEach((card) => {
    cards[card.id.toString()] = {
      id: card.id.toString(),
      title: card.title,
      details: card.details || "",
    };
  });

  return { columns, cards };
}

/**
 * Convert local CardId to API numeric ID
 */
function toApiCardId(cardId: string): number {
  return parseInt(cardId, 10);
}

/**
 * Convert local ColumnId to API numeric ID
 */
function toApiColumnId(columnId: string): number {
  return parseInt(columnId, 10);
}

export const useBoard = (): UseBoard => {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBoard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const apiBoardData = await api.fetchBoard();
      const localBoard = convertApiToLocal(apiBoardData);
      setBoard(localBoard);
    } catch (err) {
      const message =
        err instanceof api.APIError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to load board";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load board on mount
  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  const addCard = useCallback(
    async (columnId: string, title: string, details: string) => {
      if (!board) return;

      const optimisticId = `temp-${Date.now()}`;
      const optimisticCard: LocalCard = {
        id: optimisticId,
        title,
        details,
      };

      // Optimistic update
      setBoard((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          cards: { ...prev.cards, [optimisticId]: optimisticCard },
          columns: prev.columns.map((col) =>
            col.id === columnId ? { ...col, cardIds: [...col.cardIds, optimisticId] } : col
          ),
        };
      });

      try {
        const apiCard = await api.createCard({
          column_id: toApiColumnId(columnId),
          title,
          details,
        });

        // Replace temp card with real one
        setBoard((prev) => {
          if (!prev) return prev;
          const newCards = { ...prev.cards };
          delete newCards[optimisticId];
          newCards[apiCard.id.toString()] = {
            id: apiCard.id.toString(),
            title: apiCard.title,
            details: apiCard.details || "",
          };

          return {
            ...prev,
            cards: newCards,
            columns: prev.columns.map((col) =>
              col.id === columnId
                ? {
                    ...col,
                    cardIds: col.cardIds.map((id) =>
                      id === optimisticId ? apiCard.id.toString() : id
                    ),
                  }
                : col
            ),
          };
        });
      } catch (err) {
        // Revert optimistic update
        setBoard((prev) => {
          if (!prev) return prev;
          const newCards = { ...prev.cards };
          delete newCards[optimisticId];

          return {
            ...prev,
            cards: newCards,
            columns: prev.columns.map((col) =>
              col.id === columnId
                ? { ...col, cardIds: col.cardIds.filter((id) => id !== optimisticId) }
                : col
            ),
          };
        });

        const message = err instanceof Error ? err.message : "Failed to add card";
        setError(message);
        throw err;
      }
    },
    [board]
  );

  const updateCard = useCallback(
    async (cardId: string, title: string, details: string) => {
      if (!board) return;

      const oldCard = board.cards[cardId];
      if (!oldCard) return;

      // Optimistic update
      setBoard((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          cards: {
            ...prev.cards,
            [cardId]: { ...prev.cards[cardId]!, title, details },
          },
        };
      });

      try {
        await api.updateCard(toApiCardId(cardId), { title, details });
      } catch (err) {
        // Revert optimistic update
        setBoard((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            cards: { ...prev.cards, [cardId]: oldCard },
          };
        });

        const message = err instanceof Error ? err.message : "Failed to update card";
        setError(message);
        throw err;
      }
    },
    [board]
  );

  const deleteCard = useCallback(
    async (cardId: string) => {
      if (!board) return;

      const columnId = board.columns.find((col) => col.cardIds.includes(cardId))?.id;
      if (!columnId) return;

      // Optimistic update
      setBoard((prev) => {
        if (!prev) return prev;
        const newCards = { ...prev.cards };
        delete newCards[cardId];

        return {
          ...prev,
          cards: newCards,
          columns: prev.columns.map((col) =>
            col.id === columnId
              ? { ...col, cardIds: col.cardIds.filter((id) => id !== cardId) }
              : col
          ),
        };
      });

      try {
        await api.deleteCard(toApiCardId(cardId));
      } catch (err) {
        // Revert optimistic update
        await loadBoard();

        const message = err instanceof Error ? err.message : "Failed to delete card";
        setError(message);
        throw err;
      }
    },
    [board, loadBoard]
  );

  const renameColumn = useCallback(
    async (columnId: string, title: string) => {
      if (!board) return;

      const oldColumn = board.columns.find((col) => col.id === columnId);
      if (!oldColumn) return;

      // Optimistic update
      setBoard((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          columns: prev.columns.map((col) =>
            col.id === columnId ? { ...col, title } : col
          ),
        };
      });

      try {
        await api.updateColumn(toApiColumnId(columnId), { title });
      } catch (err) {
        // Revert optimistic update
        setBoard((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            columns: prev.columns.map((col) =>
              col.id === columnId ? oldColumn : col
            ),
          };
        });

        const message = err instanceof Error ? err.message : "Failed to rename column";
        setError(message);
        throw err;
      }
    },
    [board]
  );

  const moveCard = useCallback(
    async (cardId: string, fromColumnId: string, toColumnId: string) => {
      if (!board) return;

      const backupBoard = board;

      // Optimistic update - move card to new column
      setBoard((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          columns: prev.columns.map((col) => {
            if (col.id === fromColumnId) {
              return { ...col, cardIds: col.cardIds.filter((id) => id !== cardId) };
            }
            if (col.id === toColumnId) {
              return { ...col, cardIds: [...col.cardIds, cardId] };
            }
            return col;
          }),
        };
      });

      try {
        // Send all card positions to backend
        const updates: api.BoardUpdate = {
          cards: board.columns.flatMap((col) =>
            col.cardIds.map((id, idx) => ({
              id: toApiCardId(id),
              column_id: toApiColumnId(col.id),
              position: idx,
            }))
          ),
        };

        await api.updateBoard(updates);
      } catch (err) {
        // Revert optimistic update
        setBoard(backupBoard);

        const message = err instanceof Error ? err.message : "Failed to move card";
        setError(message);
        throw err;
      }
    },
    [board]
  );

  return {
    board,
    isLoading,
    error,
    addCard,
    updateCard,
    deleteCard,
    renameColumn,
    moveCard,
    retry: loadBoard,
  };
};
