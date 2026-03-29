"use client";

import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useMemo, useState } from "react";
import { applyDrag, Card, Column, DragTarget } from "@/lib/kanban";

const initialColumns: Column[] = [
  { id: "col-backlog", title: "Backlog" },
  { id: "col-discovery", title: "Discovery" },
  { id: "col-design", title: "Design" },
  { id: "col-build", title: "Build" },
  { id: "col-launch", title: "Launch" },
];

const initialCards: Card[] = [
  {
    id: "card-1",
    columnId: "col-backlog",
    title: "Customer research sprint",
    details: "Interview five power users and synthesize themes.",
  },
  {
    id: "card-2",
    columnId: "col-backlog",
    title: "Scope the Q2 roadmap",
    details: "Define must-haves and nice-to-haves with stakeholders.",
  },
  {
    id: "card-3",
    columnId: "col-discovery",
    title: "Prototype the new onboarding",
    details: "Clickable flow for the new account experience.",
  },
  {
    id: "card-4",
    columnId: "col-design",
    title: "Design system refresh",
    details: "Update typography and component tokens.",
  },
  {
    id: "card-5",
    columnId: "col-build",
    title: "Implement Kanban drag",
    details: "Smooth drag and drop transitions for cards.",
  },
];

const createCardId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `card-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const getInitialDrafts = () =>
  Object.fromEntries(
    initialColumns.map((column) => [column.id, { title: "", details: "" }])
  ) as Record<string, { title: string; details: string }>;

const CardItem = ({ card, onDelete }: { card: Card; onDelete: () => void }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: { type: "card", columnId: card.columnId },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`card ${isDragging ? "card--dragging" : ""}`}
      data-testid={`card-${card.id}`}
      {...attributes}
      {...listeners}
    >
      <div className="card__title">{card.title}</div>
      <p className="card__details">{card.details}</p>
      <div className="card__actions">
        <button
          className="card__delete"
          type="button"
          aria-label={`Delete ${card.title}`}
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
        >
          Delete
        </button>
      </div>
    </article>
  );
};

export default function Home() {
  const [columns, setColumns] = useState<Column[]>(initialColumns);
  const [cards, setCards] = useState<Card[]>(initialCards);
  const [drafts, setDrafts] = useState(getInitialDrafts);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const activeCard = useMemo(
    () => cards.find((card) => card.id === activeId) || null,
    [activeId, cards]
  );

  const handleRenameColumn = (columnId: string, title: string) => {
    setColumns((prev) =>
      prev.map((column) =>
        column.id === columnId ? { ...column, title } : column
      )
    );
  };

  const handleDraftChange = (
    columnId: string,
    field: "title" | "details",
    value: string
  ) => {
    setDrafts((prev) => ({
      ...prev,
      [columnId]: {
        ...prev[columnId],
        [field]: value,
      },
    }));
  };

  const handleAddCard = (columnId: string) => {
    const draft = drafts[columnId];
    if (!draft.title.trim()) {
      return;
    }

    const nextCard: Card = {
      id: createCardId(),
      columnId,
      title: draft.title.trim(),
      details: draft.details.trim() || "No details yet.",
    };

    setCards((prev) => [...prev, nextCard]);
    setDrafts((prev) => ({
      ...prev,
      [columnId]: { title: "", details: "" },
    }));
  };

  const handleDeleteCard = (cardId: string) => {
    setCards((prev) => prev.filter((card) => card.id !== cardId));
  };

  const handleDragStart = (event: { active: { id: string } }) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: {
    active: { id: string };
    over: { id: string; data: { current?: DragTarget } } | null;
  }) => {
    setActiveId(null);

    if (!event.over) {
      return;
    }

    const overData = event.over.data.current;
    if (!overData) {
      return;
    }

    const nextCards = applyDrag({
      cards,
      columns,
      activeId: String(event.active.id),
      over: {
        id: String(event.over.id),
        type: overData.type,
        columnId: overData.columnId,
      },
    });

    setCards(nextCards);
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  return (
    <div className="app">
      <header className="app__header">
        <span className="app__eyebrow">Single Board</span>
        <h1 className="app__title">Kanban Atlas</h1>
        <p className="app__subtitle">
          A focused board for teams that want momentum, clarity, and a clean
          workflow. Rename columns, drop cards, and keep the week moving.
        </p>
      </header>

      <section className="board">
        {mounted ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <div className="columns">
              {columns.map((column) => {
                const columnCards = cards.filter(
                  (card) => card.columnId === column.id
                );
                const columnDraft = drafts[column.id];

                return (
                  <ColumnSection
                    key={column.id}
                    column={column}
                    cards={columnCards}
                    draft={columnDraft}
                    onRename={handleRenameColumn}
                    onDraftChange={handleDraftChange}
                    onAddCard={handleAddCard}
                    onDeleteCard={handleDeleteCard}
                  />
                );
              })}
            </div>

            <DragOverlay>
              {activeCard ? (
                <div className="card card--dragging">
                  <div className="card__title">{activeCard.title}</div>
                  <p className="card__details">{activeCard.details}</p>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        ) : (
          <div className="columns">
            {columns.map((column) => {
              const columnCards = cards.filter(
                (card) => card.columnId === column.id
              );
              return (
                <div key={column.id} className="column">
                  <div className="column__header">
                    <input
                      className="column__title"
                      value={column.title}
                      readOnly
                    />
                    <span className="column__count">{columnCards.length}</span>
                  </div>
                  <div
                    className="column__body"
                    data-testid={`column-body-${column.id}`}
                  >
                    {columnCards.map((card) => (
                      <article key={card.id} className="card">
                        <div className="card__title">{card.title}</div>
                        <p className="card__details">{card.details}</p>
                      </article>
                    ))}
                    {columnCards.length === 0 ? (
                      <div className="column__empty">Drop cards here</div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

const ColumnSection = ({
  column,
  cards,
  draft,
  onRename,
  onDraftChange,
  onAddCard,
  onDeleteCard,
}: {
  column: Column;
  cards: Card[];
  draft: { title: string; details: string };
  onRename: (columnId: string, title: string) => void;
  onDraftChange: (
    columnId: string,
    field: "title" | "details",
    value: string
  ) => void;
  onAddCard: (columnId: string) => void;
  onDeleteCard: (cardId: string) => void;
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${column.id}`,
    data: { type: "column", columnId: column.id },
  });

  return (
    <div className="column" data-testid={`column-${column.id}`}>
      <div className="column__header">
        <input
          className="column__title"
          value={column.title}
          onChange={(event) => onRename(column.id, event.target.value)}
          aria-label={`Column name for ${column.title}`}
        />
        <span className="column__count">{cards.length}</span>
      </div>

      <div
        ref={setNodeRef}
        className={`column__body ${isOver ? "column__body--over" : ""}`}
        data-testid={`column-body-${column.id}`}
      >
        <SortableContext
          items={cards.map((card) => card.id)}
          strategy={verticalListSortingStrategy}
        >
          {cards.map((card) => (
            <CardItem
              key={card.id}
              card={card}
              onDelete={() => onDeleteCard(card.id)}
            />
          ))}
        </SortableContext>

        {cards.length === 0 ? (
          <div className="column__empty">Drop cards here</div>
        ) : null}
      </div>

      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          onAddCard(column.id);
        }}
      >
        <input
          placeholder="Card title"
          value={draft.title}
          onChange={(event) =>
            onDraftChange(column.id, "title", event.target.value)
          }
          aria-label={`Add card title for ${column.title}`}
        />
        <textarea
          placeholder="Details"
          value={draft.details}
          onChange={(event) =>
            onDraftChange(column.id, "details", event.target.value)
          }
          aria-label={`Add card details for ${column.title}`}
        />
        <button className="composer__button" type="submit">
          Add card
        </button>
      </form>
    </div>
  );
};
