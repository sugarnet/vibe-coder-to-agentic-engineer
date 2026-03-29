import { applyDrag, Card, Column } from "./kanban";

describe("applyDrag", () => {
  const columns: Column[] = [
    { id: "col-a", title: "A" },
    { id: "col-b", title: "B" },
  ];

  const baseCards: Card[] = [
    { id: "card-1", columnId: "col-a", title: "One", details: "" },
    { id: "card-2", columnId: "col-a", title: "Two", details: "" },
    { id: "card-3", columnId: "col-b", title: "Three", details: "" },
  ];

  it("moves a card into another column", () => {
    const next = applyDrag({
      cards: baseCards,
      columns,
      activeId: "card-1",
      over: { id: "column-col-b", type: "column", columnId: "col-b" },
    });

    const targetCards = next.filter((card) => card.columnId === "col-b");
    expect(targetCards.map((card) => card.id)).toEqual(["card-3", "card-1"]);
  });

  it("reorders cards within the same column", () => {
    const next = applyDrag({
      cards: baseCards,
      columns,
      activeId: "card-2",
      over: { id: "card-1", type: "card", columnId: "col-a" },
    });

    const columnCards = next.filter((card) => card.columnId === "col-a");
    expect(columnCards.map((card) => card.id)).toEqual(["card-2", "card-1"]);
  });

  it("inserts a card before the hovered card in a new column", () => {
    const next = applyDrag({
      cards: baseCards,
      columns,
      activeId: "card-1",
      over: { id: "card-3", type: "card", columnId: "col-b" },
    });

    const columnCards = next.filter((card) => card.columnId === "col-b");
    expect(columnCards.map((card) => card.id)).toEqual(["card-1", "card-3"]);
  });
});
