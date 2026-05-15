import { useCallback, useEffect, useState } from "react";
import * as api from "@/lib/api";
import type { BoardData, Card as LocalCard, Column as LocalColumn } from "@/lib/kanban";

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

const toApiId = (id: string): number => parseInt(id, 10);

function apiCardToLocal(card: api.Card): LocalCard {
  return {
    id: card.id.toString(),
    title: card.title,
    details: card.details || "",
    priority: card.priority ?? undefined,
    due_date: card.due_date ?? undefined,
    color: card.color ?? undefined,
  };
}

function convertApiToLocal(apiBoard: api.Board): BoardData {
  const columns: LocalColumn[] = apiBoard.columns.map((col) => ({
    id: col.id.toString(),
    title: col.title,
    cardIds: apiBoard.cards
      .filter((card) => card.column_id === col.id)
      .sort((a, b) => a.position - b.position)
      .map((card) => card.id.toString()),
  }));

  const cards: Record<string, LocalCard> = {};
  apiBoard.cards.forEach((card) => {
    cards[card.id.toString()] = apiCardToLocal(card);
  });

  return { columns, cards };
}

function buildBulkUpdate(columns: LocalColumn[]): api.BoardUpdate {
  return {
    columns: columns.map((col, idx) => ({
      id: toApiId(col.id),
      title: col.title,
      position: idx,
    })),
    cards: columns.flatMap((col) =>
      col.cardIds
        .filter((id) => !id.startsWith("temp-"))
        .map((id, idx) => ({
          id: toApiId(id),
          column_id: toApiId(col.id),
          position: idx,
        })),
    ),
  };
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
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
      const apiBoard = id ? await api.fetchBoardById(id) : await api.fetchBoard();
      setBoard(convertApiToLocal(apiBoard));
      setBoardId(apiBoard.id);
      setBoardTitle(apiBoard.title);
    } catch (err) {
      setError(errorMessage(err, "Failed to load board"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBoard(initialBoardId);
  }, [loadBoard, initialBoardId]);

  const loadBoardById = useCallback((id: number) => loadBoard(id), [loadBoard]);

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

      setBoard((prev) => prev && {
        ...prev,
        cards: { ...prev.cards, [optimisticId]: optimisticCard },
        columns: prev.columns.map((col) =>
          col.id === columnId ? { ...col, cardIds: [...col.cardIds, optimisticId] } : col,
        ),
      });

      try {
        const apiCard = await api.createCard({
          column_id: toApiId(columnId),
          title,
          details,
          ...(priority && { priority: priority as "low" | "medium" | "high" }),
          ...(dueDate && { due_date: dueDate }),
        });

        setBoard((prev) => {
          if (!prev) return prev;
          const newCards = { ...prev.cards };
          delete newCards[optimisticId];
          newCards[apiCard.id.toString()] = apiCardToLocal(apiCard);
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
        setError(errorMessage(err, "Failed to add card"));
        throw err;
      }
    },
    [board],
  );

  const updateCard = useCallback(
    async (cardId: string, title: string, details: string) => {
      if (!board) return;
      const previous = board.cards[cardId];
      if (!previous) return;

      setBoard((prev) => prev && {
        ...prev,
        cards: { ...prev.cards, [cardId]: { ...previous, title, details } },
      });

      try {
        await api.updateCard(toApiId(cardId), { title, details });
      } catch (err) {
        setBoard((prev) => prev && { ...prev, cards: { ...prev.cards, [cardId]: previous } });
        setError(errorMessage(err, "Failed to update card"));
        throw err;
      }
    },
    [board],
  );

  const updateCardFields = useCallback(
    async (cardId: string, updates: api.CardUpdate) => {
      if (!board) return;
      const previous = board.cards[cardId];
      if (!previous) return;

      setBoard((prev) => prev && {
        ...prev,
        cards: {
          ...prev.cards,
          [cardId]: {
            ...previous,
            ...(updates.title !== undefined && { title: updates.title }),
            ...(updates.details !== undefined && { details: updates.details || "" }),
            priority: updates.priority === null ? undefined : (updates.priority ?? previous.priority),
            due_date: updates.due_date === null ? undefined : (updates.due_date ?? previous.due_date),
            color: updates.color === null ? undefined : (updates.color ?? previous.color),
          },
        },
      });

      try {
        await api.updateCard(toApiId(cardId), updates);
      } catch (err) {
        setBoard((prev) => prev && { ...prev, cards: { ...prev.cards, [cardId]: previous } });
        setError(errorMessage(err, "Failed to update card"));
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
        await api.deleteCard(toApiId(cardId));
      } catch (err) {
        await loadBoard(boardId ?? undefined);
        setError(errorMessage(err, "Failed to delete card"));
        throw err;
      }
    },
    [board, boardId, loadBoard],
  );

  const renameColumn = useCallback(
    async (columnId: string, title: string) => {
      if (!board || !boardId) return;
      const previousColumn = board.columns.find((col) => col.id === columnId);
      if (!previousColumn) return;

      const nextColumns = board.columns.map((col) =>
        col.id === columnId ? { ...col, title } : col,
      );
      setBoard((prev) => prev && { ...prev, columns: nextColumns });

      try {
        await api.updateBoardById(boardId, buildBulkUpdate(nextColumns));
      } catch (err) {
        setBoard((prev) => prev && {
          ...prev,
          columns: prev.columns.map((col) => (col.id === columnId ? previousColumn : col)),
        });
        setError(errorMessage(err, "Failed to rename column"));
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
        setBoard((prev) => prev && {
          ...prev,
          columns: [...prev.columns, { id: newCol.id.toString(), title: newCol.title, cardIds: [] }],
        });
      } catch (err) {
        setError(errorMessage(err, "Failed to add column"));
        throw err;
      }
    },
    [boardId],
  );

  const deleteColumn = useCallback(
    async (columnId: string) => {
      if (!boardId || !board) return;
      const backup = board;

      setBoard((prev) => prev && {
        ...prev,
        columns: prev.columns.filter((col) => col.id !== columnId),
      });

      try {
        await api.deleteColumn(boardId, toApiId(columnId));
      } catch (err) {
        setBoard(backup);
        setError(errorMessage(err, "Failed to delete column"));
        throw err;
      }
    },
    [board, boardId],
  );

  const moveCard = useCallback(
    async (cardId: string, fromColumnId: string, toColumnId: string) => {
      if (!board || !boardId) return;
      const backup = board;

      const nextColumns = board.columns.map((col) => {
        if (col.id === fromColumnId) {
          return { ...col, cardIds: col.cardIds.filter((id) => id !== cardId) };
        }
        if (col.id === toColumnId) {
          return { ...col, cardIds: [...col.cardIds, cardId] };
        }
        return col;
      });

      setBoard((prev) => prev && { ...prev, columns: nextColumns });

      try {
        const updates = buildBulkUpdate(nextColumns);
        if (updates.cards.length === 0) return;
        await api.updateBoardById(boardId, updates);
      } catch (err) {
        setBoard(backup);
        setError(errorMessage(err, "Failed to move card"));
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
