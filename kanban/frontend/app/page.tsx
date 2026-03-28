"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";

type KanbanCard = {
  id: string;
  title: string;
  details: string;
};

type KanbanColumn = {
  id: string;
  title: string;
  cardIds: string[];
};

const initialColumns: KanbanColumn[] = [
  { id: "todo", title: "Por hacer", cardIds: ["card-1", "card-2"] },
  { id: "inprogress", title: "En progreso", cardIds: ["card-3"] },
  { id: "review", title: "Revisión", cardIds: [] },
  { id: "done", title: "Finalizado", cardIds: [] },
  { id: "ideas", title: "Ideas", cardIds: ["card-4"] },
];

const initialCards: Record<string, KanbanCard> = {
  "card-1": {
    id: "card-1",
    title: "Diseñar esquema",
    details: "Color y tipografía principal",
  },
  "card-2": {
    id: "card-2",
    title: "Configurar proyecto",
    details: "Next.js + TypeScript + DnD",
  },
  "card-3": {
    id: "card-3",
    title: "Implementar modelo de datos",
    details: "Columnas y tarjetas en estado",
  },
  "card-4": {
    id: "card-4",
    title: "UX premium",
    details: "Animaciones y estilo limpio",
  },
};

type FormState = Record<string, { title: string; details: string }>;

function DraggableCard({
  card,
  onDelete,
}: {
  card: KanbanCard;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: card.id });

  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    opacity: isDragging ? 0.7 : 1,
  } as React.CSSProperties;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="mb-3 rounded-lg border border-slate-300 bg-white p-3 shadow-sm hover:border-blue-400"
      data-testid={`card-${card.id}`}
      {...attributes}
    >
      <div className="flex items-center justify-between">
        <h4
          className="text-sm font-semibold text-[#032147] flex-1"
          {...listeners}
        >
          {card.title}
        </h4>
        <button
          onClick={() => onDelete(card.id)}
          className="text-xs text-[#753991] hover:text-[#ecad0a] ml-2 flex-shrink-0"
          aria-label={`Eliminar ${card.title}`}
          type="button"
        >
          ×
        </button>
      </div>
      <p className="mt-1 text-xs text-[#888888]">{card.details}</p>
    </div>
  );
}

function DroppableColumn({
  column,
  cards,
  formData,
  onInputChange,
  onAddCard,
  onDeleteCard,
  onRename,
}: {
  column: KanbanColumn;
  cards: KanbanCard[];
  formData: { title: string; details: string };
  onInputChange: (field: "title" | "details", value: string) => void;
  onAddCard: () => void;
  onDeleteCard: (id: string) => void;
  onRename: (value: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <section
      ref={setNodeRef}
      className={`h-full min-h-[420px] w-full max-w-[320px] rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition ${
        isOver ? "border-blue-300 ring-2 ring-blue-100" : ""
      }`}
      data-testid={`column-${column.id}`}
    >
      <input
        value={column.title}
        onChange={(e) => onRename(e.target.value)}
        className="mb-3 w-full rounded-md border border-slate-300 px-2 py-1 text-base font-bold text-[#032147] focus:border-[#209dd7] focus:outline-none"
        aria-label={`Renombrar ${column.title}`}
      />

      <div className="mb-3 flex flex-col gap-2">
        {cards.map((card) => (
          <DraggableCard key={card.id} card={card} onDelete={onDeleteCard} />
        ))}
      </div>

      <div className="space-y-2 rounded-md border border-slate-200 p-2 bg-slate-50">
        <input
          value={formData.title}
          onChange={(e) => onInputChange("title", e.target.value)}
          placeholder="Título tarjeta"
          className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
        />
        <input
          value={formData.details}
          onChange={(e) => onInputChange("details", e.target.value)}
          placeholder="Detalles"
          className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
        />
        <button
          onClick={onAddCard}
          className="w-full rounded-md bg-[#753991] px-3 py-1 text-sm font-semibold text-white hover:bg-[#209dd7]"
        >
          Agregar tarjeta
        </button>
      </div>
    </section>
  );
}

export default function Home() {
  const [isMounted, setIsMounted] = useState(false);
  const [columns, setColumns] = useState<KanbanColumn[]>(initialColumns);
  const [cards, setCards] = useState<Record<string, KanbanCard>>(initialCards);
  const [formValues, setFormValues] = useState<FormState>(() =>
    initialColumns.reduce((acc, col) => {
      acc[col.id] = { title: "", details: "" };
      return acc;
    }, {} as FormState),
  );
  const cardIdRef = useRef(100);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  const cardsByColumn = useMemo(() => {
    return columns.reduce(
      (acc, col) => {
        acc[col.id] = col.cardIds
          .map((cardId) => cards[cardId])
          .filter(Boolean);
        return acc;
      },
      {} as Record<string, KanbanCard[]>,
    );
  }, [columns, cards]);

  const handleAddCard = (columnId: string) => {
    const input = formValues[columnId];
    if (!input?.title.trim()) return;

    const cardId = `card-${cardIdRef.current++}`;
    const newCard = {
      id: cardId,
      title: input.title.trim(),
      details: input.details.trim(),
    };

    setCards((prev) => ({ ...prev, [cardId]: newCard }));
    setColumns((prev) =>
      prev.map((col) =>
        col.id === columnId
          ? { ...col, cardIds: [...col.cardIds, cardId] }
          : col,
      ),
    );
    setFormValues((prev) => ({
      ...prev,
      [columnId]: { title: "", details: "" },
    }));
  };

  const handleDeleteCard = (cardId: string) => {
    setColumns((prev) =>
      prev.map((col) => ({
        ...col,
        cardIds: col.cardIds.filter((id) => id !== cardId),
      })),
    );
    setCards((prev) => {
      const updated = { ...prev };
      delete updated[cardId];
      return updated;
    });
  };

  const handleRenameColumn = (columnId: string, title: string) => {
    setColumns((prev) =>
      prev.map((col) => (col.id === columnId ? { ...col, title } : col)),
    );
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return;
    const cardId = active.id as string;
    const destinationColumnId = over.id as string;

    const sourceColumn = columns.find((col) => col.cardIds.includes(cardId));
    if (!sourceColumn || sourceColumn.id === destinationColumnId) return;

    setColumns((prev) =>
      prev.map((col) => {
        if (col.id === sourceColumn.id) {
          return { ...col, cardIds: col.cardIds.filter((id) => id !== cardId) };
        }
        if (col.id === destinationColumnId) {
          return { ...col, cardIds: [...col.cardIds, cardId] };
        }
        return col;
      }),
    );
  };

  return (
    <div className="min-h-screen bg-[#f7f9fc] p-4 text-sm text-[#032147]">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-bold text-[#032147]">
            Kanban Board MVP
          </h1>
          <p className="mt-1 text-slate-600">
            Arrastra tarjetas entre columnas, agrega y elimina.
          </p>
        </header>

        {isMounted && (
          <DndContext onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
              {columns.map((column) => (
                <DroppableColumn
                  key={column.id}
                  column={column}
                  cards={cardsByColumn[column.id] || []}
                  formData={formValues[column.id]}
                  onInputChange={(field, value) =>
                    setFormValues((prev) => ({
                      ...prev,
                      [column.id]: { ...prev[column.id], [field]: value },
                    }))
                  }
                  onAddCard={() => handleAddCard(column.id)}
                  onDeleteCard={(id) => handleDeleteCard(id)}
                  onRename={(title) => handleRenameColumn(column.id, title)}
                />
              ))}
            </div>
          </DndContext>
        )}
      </div>
    </div>
  );
}
