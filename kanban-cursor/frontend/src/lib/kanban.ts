import { type Card, type Column } from "@/types/kanban";

export const BOARD_TITLE = "Product Launch Board";

export const createInitialColumns = (): Column[] => [
  {
    id: "column-backlog",
    name: "Backlog",
    cards: [
      {
        id: "card-1",
        title: "Define launch goals",
        details: "Align KPIs and publish success criteria for the team.",
      },
      {
        id: "card-2",
        title: "Collect user feedback",
        details: "Review interviews from beta customers and prioritize insights.",
      },
    ],
  },
  {
    id: "column-todo",
    name: "To Do",
    cards: [
      {
        id: "card-3",
        title: "Draft onboarding copy",
        details: "Write concise in-app copy for first-time users.",
      },
    ],
  },
  {
    id: "column-progress",
    name: "In Progress",
    cards: [
      {
        id: "card-4",
        title: "Build KPI dashboard",
        details: "Implement visual cards for signups, activation and retention.",
      },
    ],
  },
  {
    id: "column-review",
    name: "Review",
    cards: [
      {
        id: "card-5",
        title: "Review sales one-pager",
        details: "Validate value props and update examples for enterprise prospects.",
      },
    ],
  },
  {
    id: "column-done",
    name: "Done",
    cards: [
      {
        id: "card-6",
        title: "Finalize launch timeline",
        details: "Confirm milestones and share with all stakeholders.",
      },
    ],
  },
];

export const addCardToColumn = (
  columns: Column[],
  columnId: string,
  title: string,
  details: string,
): Column[] =>
  columns.map((column) => {
    if (column.id !== columnId) {
      return column;
    }

    const randomId =
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const nextCard: Card = {
      id: `card-${randomId}`,
      title,
      details,
    };

    return {
      ...column,
      cards: [...column.cards, nextCard],
    };
  });

export const deleteCardFromColumn = (
  columns: Column[],
  columnId: string,
  cardId: string,
): Column[] =>
  columns.map((column) => {
    if (column.id !== columnId) {
      return column;
    }

    return {
      ...column,
      cards: column.cards.filter((card) => card.id !== cardId),
    };
  });

export const renameColumn = (
  columns: Column[],
  columnId: string,
  newName: string,
): Column[] =>
  columns.map((column) =>
    column.id === columnId ? { ...column, name: newName } : column,
  );

export const moveCardBetweenColumns = (
  columns: Column[],
  sourceCardId: string,
  targetColumnId: string,
): Column[] => {
  let movedCard: Card | null = null;

  const columnsWithoutSourceCard = columns.map((column) => {
    const sourceCard = column.cards.find((card) => card.id === sourceCardId);
    if (!sourceCard) {
      return column;
    }

    movedCard = sourceCard;
    return {
      ...column,
      cards: column.cards.filter((card) => card.id !== sourceCardId),
    };
  });

  if (!movedCard) {
    return columns;
  }

  return columnsWithoutSourceCard.map((column) => {
    if (column.id !== targetColumnId) {
      return column;
    }

    return {
      ...column,
      cards: [...column.cards, movedCard],
    };
  });
};

export const editCardInColumn = (
  columns: Column[],
  columnId: string,
  cardId: string,
  title: string,
  details: string,
): Column[] =>
  columns.map((column) => {
    if (column.id !== columnId) {
      return column;
    }

    return {
      ...column,
      cards: column.cards.map((card) =>
        card.id === cardId ? { ...card, title, details } : card,
      ),
    };
  });
