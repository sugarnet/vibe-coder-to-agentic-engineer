export type Card = {
  id: string;
  title: string;
  details: string;
  priority?: "low" | "medium" | "high";
  due_date?: string;
  color?: string;
};

export type Column = {
  id: string;
  title: string;
  cardIds: string[];
};

export type BoardData = {
  columns: Column[];
  cards: Record<string, Card>;
};

const isColumnId = (columns: Column[], id: string): boolean =>
  columns.some((column) => column.id === id);

const findColumnId = (columns: Column[], id: string): string | undefined => {
  if (isColumnId(columns, id)) return id;
  return columns.find((column) => column.cardIds.includes(id))?.id;
};

function replaceColumns(
  columns: Column[],
  updates: Record<string, string[]>,
): Column[] {
  return columns.map((column) =>
    updates[column.id] ? { ...column, cardIds: updates[column.id] } : column,
  );
}

export function moveCard(
  columns: Column[],
  activeId: string,
  overId: string,
): Column[] {
  const activeColumnId = findColumnId(columns, activeId);
  const overColumnId = findColumnId(columns, overId);
  if (!activeColumnId || !overColumnId) return columns;

  const activeColumn = columns.find((c) => c.id === activeColumnId);
  const overColumn = columns.find((c) => c.id === overColumnId);
  if (!activeColumn || !overColumn) return columns;

  const droppedOnColumn = isColumnId(columns, overId);

  if (activeColumnId === overColumnId) {
    if (droppedOnColumn) {
      const reordered = activeColumn.cardIds.filter((id) => id !== activeId);
      reordered.push(activeId);
      return replaceColumns(columns, { [activeColumnId]: reordered });
    }

    const oldIndex = activeColumn.cardIds.indexOf(activeId);
    const newIndex = activeColumn.cardIds.indexOf(overId);
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return columns;

    const reordered = [...activeColumn.cardIds];
    reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, activeId);
    return replaceColumns(columns, { [activeColumnId]: reordered });
  }

  const activeIndex = activeColumn.cardIds.indexOf(activeId);
  if (activeIndex === -1) return columns;

  const nextActive = [...activeColumn.cardIds];
  nextActive.splice(activeIndex, 1);

  const nextOver = [...overColumn.cardIds];
  if (droppedOnColumn) {
    nextOver.push(activeId);
  } else {
    const overIndex = overColumn.cardIds.indexOf(overId);
    nextOver.splice(overIndex === -1 ? nextOver.length : overIndex, 0, activeId);
  }

  return replaceColumns(columns, {
    [activeColumnId]: nextActive,
    [overColumnId]: nextOver,
  });
}

export function createId(prefix: string): string {
  const randomPart = Math.random().toString(36).slice(2, 8);
  const timePart = Date.now().toString(36);
  return `${prefix}-${randomPart}${timePart}`;
}

export const initialData: BoardData = {
  columns: [
    { id: "col-backlog", title: "Backlog", cardIds: ["card-1", "card-2"] },
    { id: "col-discovery", title: "Discovery", cardIds: ["card-3"] },
    { id: "col-progress", title: "In Progress", cardIds: ["card-4", "card-5"] },
    { id: "col-review", title: "Review", cardIds: ["card-6"] },
    { id: "col-done", title: "Done", cardIds: ["card-7", "card-8"] },
  ],
  cards: {
    "card-1": { id: "card-1", title: "Align roadmap themes", details: "Draft quarterly themes with impact statements and metrics." },
    "card-2": { id: "card-2", title: "Gather customer signals", details: "Review support tags, sales notes, and churn feedback." },
    "card-3": { id: "card-3", title: "Prototype analytics view", details: "Sketch initial dashboard layout and key drill-downs." },
    "card-4": { id: "card-4", title: "Refine status language", details: "Standardize column labels and tone across the board." },
    "card-5": { id: "card-5", title: "Design card layout", details: "Add hierarchy and spacing for scanning dense lists." },
    "card-6": { id: "card-6", title: "QA micro-interactions", details: "Verify hover, focus, and loading states." },
    "card-7": { id: "card-7", title: "Ship marketing page", details: "Final copy approved and asset pack delivered." },
    "card-8": { id: "card-8", title: "Close onboarding sprint", details: "Document release notes and share internally." },
  },
};
