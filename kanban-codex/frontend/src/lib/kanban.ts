export type Column = {
  id: string;
  title: string;
};

export type Card = {
  id: string;
  columnId: string;
  title: string;
  details: string;
};

export type DragTarget = {
  id: string;
  type: "card" | "column";
  columnId: string;
};

const getColumnCards = (cards: Card[], columnId: string) =>
  cards.filter((card) => card.columnId === columnId);

export const applyDrag = ({
  cards,
  columns,
  activeId,
  over,
}: {
  cards: Card[];
  columns: Column[];
  activeId: string;
  over: DragTarget | null;
}): Card[] => {
  if (!over) {
    return cards;
  }

  const activeCard = cards.find((card) => card.id === activeId);
  if (!activeCard) {
    return cards;
  }

  const columnOrder = columns.map((column) => column.id);
  const byColumn: Record<string, Card[]> = Object.fromEntries(
    columnOrder.map((columnId) => [
      columnId,
      getColumnCards(cards, columnId).filter((card) => card.id !== activeId),
    ])
  );

  if (over.type === "column") {
    const nextColumnCards = [
      ...byColumn[over.columnId],
      { ...activeCard, columnId: over.columnId },
    ];
    byColumn[over.columnId] = nextColumnCards;
  } else {
    const insertIndex = byColumn[over.columnId].findIndex(
      (card) => card.id === over.id
    );
    const nextCard = { ...activeCard, columnId: over.columnId };
    const nextColumnCards = [...byColumn[over.columnId]];
    const safeIndex = insertIndex < 0 ? nextColumnCards.length : insertIndex;
    nextColumnCards.splice(safeIndex, 0, nextCard);
    byColumn[over.columnId] = nextColumnCards;
  }

  return columnOrder.flatMap((columnId) => byColumn[columnId]);
};
