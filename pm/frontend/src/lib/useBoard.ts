/**
 * useBoard hook - manages board state with backend API
 */

import { useCallback, useEffect, useState } from "react";
import * as api from "@/lib/api";
import {
  type BoardData,
  type Column as LocalColumn,
  type Card as LocalCard,
} from "@/lib/kanban";

export type UseBoard = {
  board: BoardData | null;
  boardId: number | null;
  boardTitle: string;
  isLoading: boolean;
  error: string | null;
  addCard: (columnId: string, title: string, details: string, priority?: string, dueDate?: string) => Promise<void>;
  updateCard: (cardId: string, title: string, details: string) => Promise<void>;
  updateCardFields: (cardId: string, updates: api.CardUpdate) => Promise<void>;
  deleteCard: (cardId: string) => Promise<void>;
  renameColumn: (columnId: string, title: string) => Promise<void>;
  addColumn: (title: string) => Promise<void>;
  deleteColumn: (columnId: string) => Promise<void>;
  moveCard: (cardId: string, fromColumnId: string, toColumnId: string) => Promise<void>;
  retry: () => Promise<void>;
  refetch: () => Promise<void>;
  loadBoardById: (boardId: number) => Promise<void>;
};

function convertApiToLocal(apiBoardData: api.Board): BoardData {
  const columns: LocalColumn[] = apiBoardData.columns.map((col) => ({
    id: col.id.toString(),
    title: col.title,
    cardIds: apiBoardData.cards
      .filter((card) => card.column_id === col.id)
      .sort((a, b) => a.position - b.position)
      .map((card) => card.id.toString()),
  }));

  const cards: Record<string, LocalCard> = {};
  apiBoardData.cards.forEach((card) => {
    cards[card.id.toString()] = {
      id: card.id.toString(),
      title: card.title,
      details: card.details || "",
      priority: card.priority ?? undefined,
      due_date: card.due_date ?? undefined,
      color: card.color ?? undefined,
    };
  });

  return { columns, cards };
}

function toApiCardId(cardId: string): number {
  return parseInt(cardId, 10);
}

function toApiColumnId(columnId: string): number {
  return parseInt(columnId, 10);
}

export const useBoard = (initialBoardId?: number): UseBoard => {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [boardId, setBoardId] = useState<number | null>(initialBoardId ?? null);
  const [boardTitle, setBoardTitle] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBoard = useCallback(async (id?: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const apiBoardData = id ? await api.fetchBoardById(id) : await api.fetchBoard();
      const localBoard = convertApiToLocal(apiBoardData);
      setBoard(localBoard);
      setBoardId(apiBoardData.id);
      setBoardTitle(apiBoardData.title);
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

  useEffect(() => {
    loadBoard(initialBoardId);
  }, [loadBoard, initialBoardId]);

  const loadBoardById = useCallback(
    async (id: number) => {
      await loadBoard(id);
    },
    [loadBoard],
  );

  const addCard = useCallback(
    async (columnId: string, title: string, details: string, priority?: string, dueDate?: string) => {
      if (!board) return;

      const optimisticId = `temp-${Date.now()}`;
      const optimisticCard: LocalCard = {
        id: optimisticId,
        title,
        details,
        priority: (priority as "low" | "medium" | "high") || undefined,
        due_date: dueDate || undefined,
      };

      setBoard((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          cards: { ...prev.cards, [optimisticId]: optimisticCard },
          columns: prev.columns.map((col) =>
            col.id === columnId
              ? { ...col, cardIds: [...col.cardIds, optimisticId] }
              : col,
          ),
        };
      });

      try {
        const apiCard = await api.createCard({
          column_id: toApiColumnId(columnId),
          title,
          details,
          ...(priority && { priority: priority as "low" | "medium" | "high" }),
          ...(dueDate && { due_date: dueDate }),
        });

        setBoard((prev) => {
          if (!prev) return prev;
          const newCards = { ...prev.cards };
          delete newCards[optimisticId];
          newCards[apiCard.id.toString()] = {
            id: apiCard.id.toString(),
            title: apiCard.title,
            details: apiCard.details || "",
            priority: apiCard.priority ?? undefined,
            due_date: apiCard.due_date ?? undefined,
            color: apiCard.color ?? undefined,
          };

          return {
            ...prev,
            cards: newCards,
            columns: prev.columns.map((col) =>
              col.id === columnId
                ? {
                    ...col,
                    cardIds: col.cardIds.map((id) =>
                      id === optimisticId ? apiCard.id.toString() : id,
                    ),
                  }
                : col,
            ),
          };
        });
      } catch (err) {
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
                : col,
            ),
          };
        });
        const message = err instanceof Error ? err.message : "Failed to add card";
        setError(message);
        throw err;
      }
    },
    [board],
  );

  const updateCard = useCallback(
    async (cardId: string, title: string, details: string) => {
      if (!board) return;
      const oldCard = board.cards[cardId];
      if (!oldCard) return;

      setBoard((prev) => {
        if (!prev) return prev;
        return { ...prev, cards: { ...prev.cards, [cardId]: { ...prev.cards[cardId]!, title, details } } };
      });

      try {
        await api.updateCard(toApiCardId(cardId), { title, details });
      } catch (err) {
        setBoard((prev) => {
          if (!prev) return prev;
          return { ...prev, cards: { ...prev.cards, [cardId]: oldCard } };
        });
        const message = err instanceof Error ? err.message : "Failed to update card";
        setError(message);
        throw err;
      }
    },
    [board],
  );

  const updateCardFields = useCallback(
    async (cardId: string, updates: api.CardUpdate) => {
      if (!board) return;
      const oldCard = board.cards[cardId];
      if (!oldCard) return;

      setBoard((prev) => {
        if (!prev) return prev;
        const cur = prev.cards[cardId]!;
        return {
          ...prev,
          cards: {
            ...prev.cards,
            [cardId]: {
              ...cur,
              ...(updates.title !== undefined && { title: updates.title }),
              ...(updates.details !== undefined && { details: updates.details || "" }),
              priority: updates.priority === null ? undefined : (updates.priority ?? cur.priority),
              due_date: updates.due_date === null ? undefined : (updates.due_date ?? cur.due_date),
              color: updates.color === null ? undefined : (updates.color ?? cur.color),
            },
          },
        };
      });

      try {
        await api.updateCard(toApiCardId(cardId), updates);
      } catch (err) {
        setBoard((prev) => {
          if (!prev) return prev;
          return { ...prev, cards: { ...prev.cards, [cardId]: oldCard } };
        });
        const message = err instanceof Error ? err.message : "Failed to update card";
        setError(message);
        throw err;
      }
    },
    [board],
  );

  const deleteCard = useCallback(
    async (cardId: string) => {
      if (!board) return;
      const columnId = board.columns.find((col) => col.cardIds.includes(cardId))?.id;
      if (!columnId) return;

      setBoard((prev) => {
        if (!prev) return prev;
        const newCards = { ...prev.cards };
        delete newCards[cardId];
        return {
          ...prev,
          cards: newCards,
          columns: prev.columns.map((col) =>
            col.id === columnId ? { ...col, cardIds: col.cardIds.filter((id) => id !== cardId) } : col,
          ),
        };
      });

      try {
        await api.deleteCard(toApiCardId(cardId));
      } catch (err) {
        await loadBoard(boardId ?? undefined);
        const message = err instanceof Error ? err.message : "Failed to delete card";
        setError(message);
        throw err;
      }
    },
    [board, boardId, loadBoard],
  );

  const renameColumn = useCallback(
    async (columnId: string, title: string) => {
      if (!board || !boardId) return;
      const oldColumn = board.columns.find((col) => col.id === columnId);
      if (!oldColumn) return;

      setBoard((prev) => {
        if (!prev) return prev;
        return { ...prev, columns: prev.columns.map((col) => (col.id === columnId ? { ...col, title } : col)) };
      });

      try {
        const updates: api.BoardUpdate = {
          columns: board.columns.map((col, idx) => ({
            id: toApiColumnId(col.id),
            title: col.id === columnId ? title : col.title,
            position: idx,
          })),
          cards: board.columns.flatMap((col) =>
            col.cardIds.map((id, idx) => ({
              id: toApiCardId(id),
              column_id: toApiColumnId(col.id),
              position: idx,
            })),
          ),
        };
        await api.updateBoardById(boardId, updates);
      } catch (err) {
        setBoard((prev) => {
          if (!prev) return prev;
          return { ...prev, columns: prev.columns.map((col) => (col.id === columnId ? oldColumn : col)) };
        });
        const message = err instanceof Error ? err.message : "Failed to rename column";
        setError(message);
        throw err;
      }
    },
    [board, boardId],
  );

  const addColumn = useCallback(
    async (title: string) => {
      if (!boardId) return;
      try {
        const newCol = await api.addColumn(boardId, title);
        setBoard((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            columns: [...prev.columns, { id: newCol.id.toString(), title: newCol.title, cardIds: [] }],
          };
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to add column";
        setError(message);
        throw err;
      }
    },
    [boardId],
  );

  const deleteColumn = useCallback(
    async (columnId: string) => {
      if (!boardId || !board) return;
      const backupBoard = board;

      setBoard((prev) => {
        if (!prev) return prev;
        return { ...prev, columns: prev.columns.filter((col) => col.id !== columnId) };
      });

      try {
        await api.deleteColumn(boardId, toApiColumnId(columnId));
      } catch (err) {
        setBoard(backupBoard);
        const message = err instanceof Error ? err.message : "Failed to delete column";
        setError(message);
        throw err;
      }
    },
    [board, boardId],
  );

  const moveCard = useCallback(
    async (cardId: string, fromColumnId: string, toColumnId: string) => {
      if (!board || !boardId) return;
      const backupBoard = board;

      const expectedColumns = board.columns.map((col) => {
        if (col.id === fromColumnId) {
          return { ...col, cardIds: col.cardIds.filter((id) => id !== cardId) };
        }
        if (col.id === toColumnId) {
          return { ...col, cardIds: [...col.cardIds, cardId] };
        }
        return col;
      });

      setBoard((prev) => {
        if (!prev) return prev;
        return { ...prev, columns: expectedColumns };
      });

      try {
        const validCards = expectedColumns.flatMap((col) =>
          col.cardIds
            .filter((id) => !id.startsWith("temp-"))
            .map((id, idx) => ({
              id: toApiCardId(id),
              column_id: toApiColumnId(col.id),
              position: idx,
            })),
        );

        if (validCards.length === 0) return;

        const updates: api.BoardUpdate = {
          columns: expectedColumns.map((col, idx) => ({
            id: toApiColumnId(col.id),
            title: col.title,
            position: idx,
          })),
          cards: validCards,
        };

        await api.updateBoardById(boardId, updates);
      } catch (err) {
        setBoard(backupBoard);
        const message = err instanceof Error ? err.message : "Failed to move card";
        setError(message);
        throw err;
      }
    },
    [board, boardId],
  );

  return {
    board,
    boardId,
    boardTitle,
    isLoading,
    error,
    addCard,
    updateCard,
    updateCardFields,
    deleteCard,
    renameColumn,
    addColumn,
    deleteColumn,
    moveCard,
    retry: () => loadBoard(boardId ?? undefined),
    refetch: () => loadBoard(boardId ?? undefined),
    loadBoardById,
  };
};
