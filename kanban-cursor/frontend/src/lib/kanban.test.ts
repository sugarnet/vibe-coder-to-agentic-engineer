import {
  addCardToColumn,
  createInitialColumns,
  deleteCardFromColumn,
  editCardInColumn,
  moveCardBetweenColumns,
  renameColumn,
} from "@/lib/kanban";

describe("kanban helpers", () => {
  it("creates five columns on startup", () => {
    const columns = createInitialColumns();
    expect(columns).toHaveLength(5);
  });

  it("renames an existing column", () => {
    const columns = createInitialColumns();
    const renamed = renameColumn(columns, "column-backlog", "Ideas");

    expect(renamed[0].name).toBe("Ideas");
  });

  it("adds a card in the selected column", () => {
    const columns = createInitialColumns();
    const updated = addCardToColumn(
      columns,
      "column-backlog",
      "New title",
      "New details",
    );

    expect(updated[0].cards.at(-1)?.title).toBe("New title");
    expect(updated[0].cards.at(-1)?.details).toBe("New details");
  });

  it("deletes a card from the selected column", () => {
    const columns = createInitialColumns();
    const cardId = columns[0].cards[0].id;
    const updated = deleteCardFromColumn(columns, "column-backlog", cardId);

    expect(updated[0].cards.some((card) => card.id === cardId)).toBe(false);
  });

  it("moves a card to another column", () => {
    const columns = createInitialColumns();
    const sourceCardId = columns[0].cards[0].id;
    const updated = moveCardBetweenColumns(columns, sourceCardId, "column-done");

    expect(updated[0].cards.some((card) => card.id === sourceCardId)).toBe(false);
    expect(updated[4].cards.some((card) => card.id === sourceCardId)).toBe(true);
  });

  it("edits card title and details", () => {
    const columns = createInitialColumns();
    const cardId = columns[0].cards[0].id;
    const updated = editCardInColumn(
      columns,
      "column-backlog",
      cardId,
      "Updated title",
      "Updated details",
    );

    expect(updated[0].cards[0].title).toBe("Updated title");
    expect(updated[0].cards[0].details).toBe("Updated details");
  });
});
